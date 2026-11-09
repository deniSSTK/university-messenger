type StoredObjectInput = {
  key: string;
  bytes: Uint8Array;
  mediaType: string;
};
interface ObjectStorage {
  put(input: StoredObjectInput): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
  url(key: string): Promise<string>;
}
class MediaUnavailableError extends Error {
  constructor() {
    super('File storage is temporarily unavailable');
  }
}
const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
export { OBJECT_STORAGE, MediaUnavailableError };
export type { ObjectStorage, StoredObjectInput };
