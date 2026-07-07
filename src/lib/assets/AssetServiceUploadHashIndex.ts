import type { getStorageAdapter } from '@/lib/storage/adapter';
import { computeBufferHash, computeFileHash } from './core/hashing';
import { getMimeType } from './core/naming';
import {
  getAssetHashIndexEntry,
  loadAssetHashIndex,
  saveAssetHashIndex,
  setAssetHashIndexEntry,
} from './AssetHashIndex';
import {
  getKnownAssetModifiedAt,
  getKnownAssetSize,
  type NormalizedAssetDirectoryEntry,
} from './AssetServiceDirectory';
import type { UploadResult } from './types';
import type { AssetContext } from './AssetServiceTypes';

export async function saveAssetHashIndexBestEffort(
  notesRootPath: string,
  index: Parameters<typeof saveAssetHashIndex>[1],
) {
  try {
    await saveAssetHashIndex(notesRootPath, index);
  } catch {
  }
}

function isIndexedAssetFresh(
  entry: { size?: number; modifiedAt?: number | null },
  indexed: { size: number; modifiedAt: number | null },
) {
  const size = getKnownAssetSize(entry.size);
  const modifiedAt = getKnownAssetModifiedAt(entry.modifiedAt);
  return size !== undefined && size === indexed.size && modifiedAt !== undefined && modifiedAt === indexed.modifiedAt;
}

async function computeUploadHash(
  uploadMimeType: string,
  file: File,
  readPreparedUploadBytes: () => Promise<Uint8Array>,
): Promise<string> {
  return uploadMimeType === 'image/svg+xml'
    ? computeBufferHash(await readPreparedUploadBytes())
    : computeFileHash(file);
}

export async function findDuplicateAsset(
  context: AssetContext,
  storage: ReturnType<typeof getStorageAdapter>,
  storedPathPrefix: string,
  candidates: NormalizedAssetDirectoryEntry[],
  uploadSize: number,
  uploadMimeType: string,
  file: File,
  readPreparedUploadBytes: () => Promise<Uint8Array>,
  maxAssetSize: number,
): Promise<{ duplicate: UploadResult | null; fileHash: string }> {
  const fileHash = await computeUploadHash(uploadMimeType, file, readPreparedUploadBytes);
  let hashIndex = await loadAssetHashIndex(context.notesRootPath);
  let hashIndexChanged = false;

  for (const candidate of candidates) {
    const candidateFilename = storedPathPrefix + candidate.name;
    const indexed = getAssetHashIndexEntry(hashIndex, candidateFilename);
    if (indexed && isIndexedAssetFresh(candidate, indexed)) {
      if (indexed.hash === fileHash) {
        return {
          fileHash,
          duplicate: {
            success: true,
            path: candidateFilename,
            isDuplicate: true,
            existingFilename: candidateFilename,
            entry: {
              filename: candidateFilename,
              hash: indexed.hash,
              size: indexed.size,
              mimeType: indexed.mimeType,
              uploadedAt: indexed.updatedAt,
            },
          },
        };
      }
      continue;
    }

    const candidateBytes = await storage.readBinaryFile(candidate.path, maxAssetSize).catch(() => null);
    if (!candidateBytes || candidateBytes.byteLength !== uploadSize || candidateBytes.byteLength > maxAssetSize) {
      continue;
    }

    const candidateHash = await computeBufferHash(candidateBytes);
    setAssetHashIndexEntry(hashIndex, {
      filename: candidateFilename,
      hash: candidateHash,
      size: candidate.size ?? 0,
      modifiedAt: getKnownAssetModifiedAt(candidate.modifiedAt) ?? null,
      mimeType: getMimeType(candidate.name),
      updatedAt: new Date().toISOString(),
    });
    hashIndexChanged = true;

    if (candidateHash === fileHash) {
      await saveAssetHashIndexBestEffort(context.notesRootPath, hashIndex);
      return {
        fileHash,
        duplicate: {
          success: true,
          path: candidateFilename,
          isDuplicate: true,
          existingFilename: candidateFilename,
          entry: {
            filename: candidateFilename,
            hash: candidateHash,
            size: candidate.size ?? uploadSize,
            mimeType: getMimeType(candidate.name),
            uploadedAt: new Date().toISOString(),
          },
        },
      };
    }
  }

  if (hashIndexChanged) {
    await saveAssetHashIndexBestEffort(context.notesRootPath, hashIndex);
  }
  return { duplicate: null, fileHash };
}

export async function saveUploadedAssetHashIndex(
  context: AssetContext,
  entry: {
    filename: string;
    hash: string;
    size: number;
    modifiedAt: number | null | undefined;
    mimeType: string;
    updatedAt: string;
  },
) {
  const hashIndex = await loadAssetHashIndex(context.notesRootPath);
  setAssetHashIndexEntry(hashIndex, {
    filename: entry.filename,
    hash: entry.hash,
    size: entry.size,
    modifiedAt: getKnownAssetModifiedAt(entry.modifiedAt) ?? null,
    mimeType: entry.mimeType,
    updatedAt: entry.updatedAt,
  });
  await saveAssetHashIndexBestEffort(context.notesRootPath, hashIndex);
}
