import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  getKnownSyncBroadcastChannels,
  getKnownSyncStorageKeyPrefixes,
  getKnownSyncStorageKeys,
  STORAGE_AUTO_SYNC_KINDS,
  SYNC_CONTRACTS,
} from './syncContract';

const SOURCE_ROOT = join(process.cwd(), 'src');
const STORAGE_CONSTANT_PATTERN =
  /\b(?:const|export const)\s+([A-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/g;
const DIRECT_STORAGE_KEY_PATTERNS = [
  /\b(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]/g,
  /\bstorageKey\s*=\s*['"]([^'"]+)['"]/g,
];
const DIRECT_BROADCAST_CHANNEL_PATTERN = /\bnew\s+BroadcastChannel\(\s*['"]([^'"]+)['"]\s*\)/g;
const DIRECT_AUTO_SYNC_KIND_PATTERN = /\bemitStorageAutoSyncEvent\(\s*\{\s*kind:\s*['"]([^'"]+)['"]/g;

function isStorageContractConstant(name: string): boolean {
  const parts = name.split('_');
  return (
    name === 'LOCK_KEY_PREFIX' ||
    name.includes('STORAGE_KEY') ||
    parts.includes('KEY') ||
    parts.includes('CHANNEL')
  );
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'build') {
        return [];
      }
      return listSourceFiles(path);
    }

    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name) || /\.fixtures\.(ts|tsx)$/.test(name)) {
      return [];
    }

    return [path];
  });
}

describe('syncContract', () => {
  it('keeps ownership boundaries unambiguous', () => {
    const ids = new Set<string>();
    const storageKeyOwners = new Map<string, string>();
    const channelOwners = new Map<string, string>();
    const duplicateClaims: string[] = [];

    for (const entry of SYNC_CONTRACTS) {
      if (ids.has(entry.id)) {
        duplicateClaims.push(`duplicate contract id: ${entry.id}`);
      }
      ids.add(entry.id);

      for (const key of entry.storageKeys || []) {
        const existingOwner = storageKeyOwners.get(key);
        if (existingOwner) {
          duplicateClaims.push(`storage key ${key}: ${existingOwner} and ${entry.id}`);
        }
        storageKeyOwners.set(key, entry.id);
      }

      for (const channel of entry.broadcastChannels || []) {
        const existingOwner = channelOwners.get(channel);
        if (existingOwner) {
          duplicateClaims.push(`broadcast channel ${channel}: ${existingOwner} and ${entry.id}`);
        }
        channelOwners.set(channel, entry.id);
      }
    }

    expect(duplicateClaims).toEqual([]);
  });

  it('declares every storage auto-sync event kind', () => {
    const registeredKinds = new Set(SYNC_CONTRACTS.flatMap((entry) => entry.autoSyncKinds || []));

    expect(Array.from(registeredKinds).sort()).toEqual(Array.from(STORAGE_AUTO_SYNC_KINDS).sort());
  });

  it('keeps browser storage keys and broadcast channels under an explicit sync contract', () => {
    const knownKeys = getKnownSyncStorageKeys();
    const knownPrefixes = getKnownSyncStorageKeyPrefixes();
    const knownChannels = getKnownSyncBroadcastChannels();
    const knownAutoSyncKinds = new Set(STORAGE_AUTO_SYNC_KINDS);
    const missing: string[] = [];

    for (const path of listSourceFiles(SOURCE_ROOT)) {
      const source = readFileSync(path, 'utf8');

      for (const match of source.matchAll(STORAGE_CONSTANT_PATTERN)) {
        const [, name, value] = match;
        if (!isStorageContractConstant(name)) {
          continue;
        }

        if (!value.includes('vlaina') && !['fontSize', 'pendingSync', 'autoUpdate'].includes(value)) {
          continue;
        }

        const isChannel = name.includes('CHANNEL');
        const isPrefix = name.includes('PREFIX');
        const isKnown = isChannel
          ? knownChannels.has(value)
          : isPrefix
            ? knownPrefixes.includes(value)
            : knownKeys.has(value);

        if (!isKnown) {
          missing.push(`${relative(process.cwd(), path)}: ${name} = ${value}`);
        }
      }

      for (const pattern of DIRECT_STORAGE_KEY_PATTERNS) {
        for (const match of source.matchAll(pattern)) {
          const [, value] = match;
          if (!value.includes('vlaina') && !['fontSize', 'pendingSync', 'autoUpdate'].includes(value)) {
            continue;
          }

          if (!knownKeys.has(value) && !knownPrefixes.some((prefix) => value.startsWith(prefix))) {
            missing.push(`${relative(process.cwd(), path)}: storage key literal = ${value}`);
          }
        }
      }

      for (const match of source.matchAll(DIRECT_BROADCAST_CHANNEL_PATTERN)) {
        const [, value] = match;
        if (value.includes('vlaina') && !knownChannels.has(value)) {
          missing.push(`${relative(process.cwd(), path)}: broadcast channel literal = ${value}`);
        }
      }

      for (const match of source.matchAll(DIRECT_AUTO_SYNC_KIND_PATTERN)) {
        const [, value] = match;
        if (!knownAutoSyncKinds.has(value as never)) {
          missing.push(`${relative(process.cwd(), path)}: auto-sync kind literal = ${value}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('documents a cross-window policy for every registered persistent key', () => {
    const entriesWithKeys = SYNC_CONTRACTS.filter((entry) => (entry.storageKeys?.length || 0) > 0);

    expect(entriesWithKeys.length).toBeGreaterThan(0);
    for (const entry of entriesWithKeys) {
      expect(entry.notes.trim().length).toBeGreaterThan(20);
      expect(entry.mergePolicy).toBeTruthy();
      expect(typeof entry.crossWindow).toBe('boolean');
    }
  });
});
