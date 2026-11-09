import type {
  ObjectStorage,
  StoredObjectInput,
} from '../src/modules/media/domain/object-storage.port.js';
class MemoryObjectStorage implements ObjectStorage {
  readonly objects = new Map<string, Uint8Array>();
  async put(input: StoredObjectInput): Promise<void> {
    await Promise.resolve();
    this.objects.set(input.key, input.bytes.slice());
  }
  async get(key: string): Promise<Uint8Array> {
    await Promise.resolve();
    const bytes = this.objects.get(key);

    if (!bytes) {
      throw new Error('Missing object');
    }

    return bytes.slice();
  }
  async remove(key: string): Promise<void> {
    await Promise.resolve();
    this.objects.delete(key);
  }
  async url(key: string): Promise<string> {
    await Promise.resolve();

    return `https://storage.example.com/${key}?test-signed=true`;
  }
}
export { MemoryObjectStorage };
