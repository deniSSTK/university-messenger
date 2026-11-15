function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }

  return btoa(chunks.join(''));
}

export { encodeBase64 };
