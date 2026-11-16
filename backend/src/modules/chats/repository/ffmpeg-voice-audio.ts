import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { MediaUnavailableError } from '../../media/domain/object-storage.port.js';
import { InvalidVoiceAudioError } from '../domain/chats.errors.js';
import type {
  ValidatedVoiceAudio,
  VoiceAudio,
} from '../domain/voice-audio.port.js';

const run = promisify(execFile);
const MAX_DURATION_MS = 300_000;
const MAX_BYTES = 5 * 1024 * 1024;
const SAMPLE_RATE = 8_000;
const MAX_JOBS = 2;
const FORMATS = {
  'audio/webm': {
    extension: 'webm',
    codec: 'opus',
    demuxer: 'matroska',
    muxer: 'webm',
  },
  'audio/mp4': { extension: 'm4a', codec: 'aac', demuxer: 'mov', muxer: 'mp4' },
  'audio/ogg': {
    extension: 'ogg',
    codec: 'opus',
    demuxer: 'ogg',
    muxer: 'ogg',
  },
} as const;

function matchesContainer(bytes: Uint8Array, type: string): boolean {
  const header = Buffer.from(bytes.subarray(0, 256));

  switch (type) {
    case 'audio/webm':
      return (
        header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
        header.includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))
      );
    case 'audio/mp4':
      return header.toString('ascii', 4, 8) === 'ftyp';
    case 'audio/ogg':
      return header.toString('ascii', 0, 4) === 'OggS';
    default:
      return false;
  }
}

function waveform(pcm: Buffer): number[] {
  const count = pcm.length / 2;
  const peaks = Array<number>(Math.min(80, count)).fill(0);

  for (let index = 0; index < count; index++) {
    const bucket = Math.floor((index * peaks.length) / count);
    peaks[bucket] = Math.max(
      peaks[bucket],
      Math.abs(pcm.readInt16LE(index * 2)),
    );
  }

  const maximum = Math.max(1, ...peaks);

  return peaks.map((peak) => Math.round((peak * 100) / maximum));
}

class FfmpegVoiceAudio implements VoiceAudio {
  private jobs = 0;

  async prepare(
    bytes: Uint8Array,
    mediaType: string,
  ): Promise<ValidatedVoiceAudio> {
    const type = mediaType.toLowerCase().split(';')[0].trim();

    if (!Object.hasOwn(FORMATS, type) || !matchesContainer(bytes, type)) {
      throw new InvalidVoiceAudioError();
    }

    if (this.jobs >= MAX_JOBS) {
      throw new MediaUnavailableError();
    }

    const format = FORMATS[type as keyof typeof FORMATS];
    this.jobs++;
    let directory: string | undefined;

    try {
      directory = await mkdtemp(join(tmpdir(), 'messenger-voice-'));
      const input = join(directory, 'input');
      const output = join(directory, 'output');
      const options = {
        timeout: 12_000,
        windowsHide: true,
        maxBuffer: 5_100_000,
      };
      const source = [
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        format.demuxer,
        '-i',
        input,
      ];

      await writeFile(input, bytes);
      const probe = await run(
        'ffprobe',
        [
          '-v',
          'error',
          ...source,
          '-show_entries',
          'stream=codec_name,codec_type',
          '-of',
          'csv=p=0',
        ],
        { ...options, maxBuffer: 16_384 },
      );

      if (probe.stderr || probe.stdout.trim() !== format.codec + ',audio') {
        throw new InvalidVoiceAudioError();
      }

      const decoded = await run(
        'ffmpeg',
        [
          '-nostdin',
          '-v',
          'error',
          '-xerror',
          '-threads',
          '1',
          ...source,
          '-map',
          '0:a:0',
          '-af',
          'aresample=async=1:first_pts=0',
          '-t',
          '301',
          '-ac',
          '1',
          '-ar',
          String(SAMPLE_RATE),
          '-f',
          's16le',
          'pipe:1',
        ],
        { ...options, encoding: 'buffer' },
      );

      const durationMs = Math.ceil(
        (decoded.stdout.length * 1000) / (2 * SAMPLE_RATE),
      );

      if (durationMs < 1 || durationMs > MAX_DURATION_MS) {
        throw new InvalidVoiceAudioError();
      }

      await run(
        'ffmpeg',
        [
          '-nostdin',
          '-v',
          'error',
          '-xerror',
          ...source,
          '-map',
          '0:a:0',
          '-map_metadata',
          '-1',
          '-map_chapters',
          '-1',
          '-c:a',
          'copy',
          '-fs',
          String(MAX_BYTES + 1),
          ...(format.muxer === 'mp4' ? ['-movflags', '+faststart'] : []),
          '-f',
          format.muxer,
          output,
        ],
        { ...options, maxBuffer: 16_384 },
      );

      if ((await stat(output)).size > MAX_BYTES) {
        throw new InvalidVoiceAudioError();
      }

      return {
        bytes: await readFile(output),
        mediaType: type,
        extension: format.extension,
        durationMs,
        waveform: waveform(decoded.stdout),
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        ['ENOENT', 'EACCES', 'ENOSPC'].includes(String(error.code))
      ) {
        throw new MediaUnavailableError();
      }

      throw new InvalidVoiceAudioError();
    } finally {
      this.jobs--;

      if (directory) {
        await rm(directory, { force: true, recursive: true }).catch(
          () => undefined,
        );
      }
    }
  }
}

export { FfmpegVoiceAudio };
