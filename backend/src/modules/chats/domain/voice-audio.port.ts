import type { VoiceMetadata } from './chats.models.js';

type ValidatedVoiceAudio = VoiceMetadata & {
  bytes: Uint8Array;
  mediaType: string;
  extension: string;
};

interface VoiceAudio {
  prepare(bytes: Uint8Array, mediaType: string): Promise<ValidatedVoiceAudio>;
}

export type { ValidatedVoiceAudio, VoiceAudio };
