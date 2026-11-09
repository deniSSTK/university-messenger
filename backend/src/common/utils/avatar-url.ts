import type { ObjectStorage } from '../../modules/media/domain/object-storage.port.js';
type AvatarReference = { avatarUrl?: string | null; avatarKey?: string | null };
async function avatarUrl(
  person: AvatarReference,
  storage?: ObjectStorage,
): Promise<string | null | undefined> {
  if (person.avatarKey && storage) {
    return storage.url(person.avatarKey);
  }

  return person.avatarUrl;
}

export { avatarUrl };
