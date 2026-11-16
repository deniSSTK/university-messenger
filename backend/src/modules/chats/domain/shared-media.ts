const MEDIA_CATEGORIES = [
  'photos',
  'videos',
  'files',
  'audio',
  'voice',
  'gifs',
] as const;
type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
type MediaCounts = Record<MediaCategory, number>;

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const GIF_TYPE = 'image/gif';

function mediaCategory(type: string | null): Exclude<MediaCategory, 'voice'> {
  const normalized = type?.toLowerCase() ?? '';

  if (PHOTO_TYPES.includes(normalized)) {
    return 'photos';
  }

  if (normalized === GIF_TYPE) {
    return 'gifs';
  }

  if (normalized.startsWith('video/')) {
    return 'videos';
  }

  if (normalized.startsWith('audio/')) {
    return 'audio';
  }

  return 'files';
}

export { MEDIA_CATEGORIES, PHOTO_TYPES, GIF_TYPE, mediaCategory };
export type { MediaCategory, MediaCounts };
