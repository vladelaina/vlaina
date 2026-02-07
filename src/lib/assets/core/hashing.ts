const HASH_LENGTH = 16;
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;
const PRECHECK_SIZE = 64 * 1024;

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const fullHash = await sha256(buffer);
  return fullHash.substring(0, HASH_LENGTH);
}

export async function computeQuickHash(file: File): Promise<string> {
  const sizeStr = file.size.toString(16).padStart(16, '0');
  
  const previewSize = Math.min(file.size, PRECHECK_SIZE);
  const previewBuffer = await file.slice(0, previewSize).arrayBuffer();
  const previewHash = await sha256(previewBuffer);
  
  return `${sizeStr}-${previewHash.substring(0, HASH_LENGTH)}`;
}

export function isLargeFile(file: File): boolean {
  return file.size > LARGE_FILE_THRESHOLD;
}

export async function computeBufferHash(buffer: Uint8Array): Promise<string> {
  const copy = new Uint8Array(buffer);
  const fullHash = await sha256(copy.buffer as ArrayBuffer);
  return fullHash.substring(0, HASH_LENGTH);
}
