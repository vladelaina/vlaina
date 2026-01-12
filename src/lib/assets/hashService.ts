/**
 * Hash Service
 * Content-based hashing for asset deduplication
 */

const HASH_LENGTH = 16; // First 16 hex chars of SHA-256
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const PRECHECK_SIZE = 64 * 1024; // 64KB for fast pre-check

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 hash of data
 */
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Compute content hash for a file
 * Returns first 16 hex characters of SHA-256
 * 
 * For large files (>5MB), uses fast pre-check with size + first 64KB
 * before computing full hash
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const fullHash = await sha256(buffer);
  return fullHash.substring(0, HASH_LENGTH);
}

/**
 * Compute quick hash for large file pre-check
 * Uses file size + first 64KB hash
 * This is used for fast duplicate detection before computing full hash
 */
export async function computeQuickHash(file: File): Promise<string> {
  const sizeStr = file.size.toString(16).padStart(16, '0');
  
  const previewSize = Math.min(file.size, PRECHECK_SIZE);
  const previewBuffer = await file.slice(0, previewSize).arrayBuffer();
  const previewHash = await sha256(previewBuffer);
  
  // Combine size and preview hash
  return `${sizeStr}-${previewHash.substring(0, HASH_LENGTH)}`;
}

/**
 * Check if file is considered "large" for pre-check optimization
 */
export function isLargeFile(file: File): boolean {
  return file.size > LARGE_FILE_THRESHOLD;
}

/**
 * Compute hash from Uint8Array (for testing or direct buffer input)
 */
export async function computeBufferHash(buffer: Uint8Array): Promise<string> {
  // Create a copy to ensure proper ArrayBuffer type
  const copy = new Uint8Array(buffer);
  const fullHash = await sha256(copy.buffer as ArrayBuffer);
  return fullHash.substring(0, HASH_LENGTH);
}
