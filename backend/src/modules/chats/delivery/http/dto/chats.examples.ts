import { UUID_EXAMPLE } from '../../../../../core/examples/uuid.examples.js';

const createdAt = '2026-10-30T12:30:00.000Z';

const CHATS_EXAMPLES = {
  mediaCounts: { photos: 12, videos: 4, files: 7, audio: 2, voice: 3, gifs: 0 },
  username: 'alice',
  displayName: 'Alice',
  text: 'Hi! How are you?',
  createdAt,
  cursor: Buffer.from(JSON.stringify({ createdAt, id: UUID_EXAMPLE })).toString(
    'base64url',
  ),
} as const;

export { CHATS_EXAMPLES };
