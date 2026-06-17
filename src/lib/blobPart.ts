export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = bytes;
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }

  const copy = new Uint8Array(byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function toBlobPart(bytes: Uint8Array): BlobPart {
  return toArrayBuffer(bytes);
}

export function toBlobParts(parts: readonly (string | Blob | ArrayBuffer | Uint8Array)[]): BlobPart[] {
  return parts.map((part) => part instanceof Uint8Array ? toBlobPart(part) : part);
}
