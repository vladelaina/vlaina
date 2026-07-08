import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { processFilename } from '@/lib/assets/core/naming';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import {
  createWhiteboardDocument,
  deserializeWhiteboardSnapshot,
  normalizeWhiteboardSnapshot,
  type WhiteboardSnapshot,
} from './whiteboardDocument';

export interface WhiteboardIndexEntry {
  id: string;
  title: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhiteboardIndex {
  version: 1;
  activeBoardId: string;
  boards: WhiteboardIndexEntry[];
}

const WHITEBOARD_INDEX_MAX_BYTES = 256 * 1024;
const WHITEBOARD_BOARD_MAX_BYTES = 16 * 1024 * 1024;
const WHITEBOARD_ASSET_MAX_BYTES = 50 * 1024 * 1024;
const WHITEBOARD_SYSTEM_DIR = '.vlaina';
const WHITEBOARD_DIR = 'whiteboards';
const WHITEBOARD_BOARDS_DIR = 'boards';
const WHITEBOARD_INDEX_FILE = 'index.json';
const WHITEBOARD_BOARD_FILE = 'board.vlwb.json';
const WHITEBOARD_ASSETS_DIR = 'assets';
const DEFAULT_BOARD_ID = 'default';
const DEFAULT_BOARD_TITLE = 'Board';

export async function getWhiteboardStorageTree(notesRootPath: string) {
  const rootPath = await joinPath(notesRootPath, WHITEBOARD_SYSTEM_DIR, WHITEBOARD_DIR);
  const boardsPath = await joinPath(rootPath, WHITEBOARD_BOARDS_DIR);
  const indexPath = await joinPath(rootPath, WHITEBOARD_INDEX_FILE);
  return { boardsPath, indexPath, rootPath };
}

export async function loadWhiteboardIndex(notesRootPath: string): Promise<WhiteboardIndex> {
  const storage = getStorageAdapter();
  const { indexPath } = await getWhiteboardStorageTree(notesRootPath);
  if (!await storage.exists(indexPath)) {
    return createDefaultWhiteboardIndex();
  }
  try {
    return normalizeWhiteboardIndex(JSON.parse(await storage.readFile(indexPath, WHITEBOARD_INDEX_MAX_BYTES)));
  } catch {
    return createDefaultWhiteboardIndex();
  }
}

export async function writeWhiteboardIndex(notesRootPath: string, index: WhiteboardIndex): Promise<void> {
  const storage = getStorageAdapter();
  const { indexPath } = await getWhiteboardStorageTree(notesRootPath);
  await storage.writeFile(indexPath, JSON.stringify(normalizeWhiteboardIndex(index), null, 2), { recursive: true });
}

export async function readWhiteboardBoard(
  notesRootPath: string,
  board: WhiteboardIndexEntry,
): Promise<WhiteboardSnapshot | null> {
  const storage = getStorageAdapter();
  const boardPath = await getWhiteboardBoardPath(notesRootPath, board);
  if (!await storage.exists(boardPath)) return null;
  const snapshot = deserializeWhiteboardSnapshot(await storage.readFile(boardPath, WHITEBOARD_BOARD_MAX_BYTES));
  return snapshot ? hydrateWhiteboardAssets(notesRootPath, board, snapshot) : null;
}

export async function writeWhiteboardBoard(
  notesRootPath: string,
  board: WhiteboardIndexEntry,
  snapshot: WhiteboardSnapshot,
): Promise<void> {
  const storage = getStorageAdapter();
  const boardPath = await getWhiteboardBoardPath(notesRootPath, board);
  await storage.mkdir(await getWhiteboardAssetsPath(notesRootPath, board), true);
  await storage.writeFile(boardPath, JSON.stringify(createWhiteboardDocument(snapshot), null, 2), { recursive: true });
}

export async function createWhiteboardEntry(
  notesRootPath: string,
  title = DEFAULT_BOARD_TITLE,
): Promise<{ entry: WhiteboardIndexEntry; index: WhiteboardIndex }> {
  const index = await loadWhiteboardIndex(notesRootPath);
  const now = new Date().toISOString();
  const entry: WhiteboardIndexEntry = {
    createdAt: now,
    folder: getAvailableFolder(index.boards, slugifyWhiteboardTitle(title) || 'board'),
    id: `board-${Date.now()}`,
    title,
    updatedAt: now,
  };
  const nextIndex = normalizeWhiteboardIndex({
    ...index,
    activeBoardId: entry.id,
    boards: [...index.boards, entry],
  });
  await writeWhiteboardBoard(notesRootPath, entry, normalizeWhiteboardSnapshot({}));
  await writeWhiteboardIndex(notesRootPath, nextIndex);
  return { entry, index: nextIndex };
}

export async function writeWhiteboardAsset(
  notesRootPath: string,
  board: WhiteboardIndexEntry,
  file: File,
): Promise<string> {
  const storage = getStorageAdapter();
  const assetsPath = await getWhiteboardAssetsPath(notesRootPath, board);
  const existingFiles = await storage.listDir(assetsPath).catch(() => []);
  const filename = processFilename(
    file.name || 'image.png',
    new Set(existingFiles.filter((item) => item.isFile).map((item) => item.name)),
    160,
  );
  const fullPath = await joinPath(assetsPath, filename);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > WHITEBOARD_ASSET_MAX_BYTES) {
    throw new Error('Whiteboard image is too large');
  }
  await storage.writeBinaryFile(fullPath, bytes, { recursive: true });
  return `${WHITEBOARD_ASSETS_DIR}/${filename}`;
}

export function createDefaultWhiteboardIndex(now = new Date().toISOString()): WhiteboardIndex {
  return {
    activeBoardId: DEFAULT_BOARD_ID,
    boards: [{
      createdAt: now,
      folder: DEFAULT_BOARD_ID,
      id: DEFAULT_BOARD_ID,
      title: DEFAULT_BOARD_TITLE,
      updatedAt: now,
    }],
    version: 1,
  };
}

export function normalizeWhiteboardIndex(value: unknown): WhiteboardIndex {
  if (!isRecord(value)) return createDefaultWhiteboardIndex();
  const boards = Array.isArray(value.boards)
    ? value.boards.flatMap((item) => {
      const board = normalizeBoardEntry(item);
      return board ? [board] : [];
    })
    : [];
  const normalizedBoards = boards.length > 0 ? boards : createDefaultWhiteboardIndex().boards;
  const activeBoardId = typeof value.activeBoardId === 'string' &&
    normalizedBoards.some((board) => board.id === value.activeBoardId)
    ? value.activeBoardId
    : normalizedBoards[0].id;
  return { activeBoardId, boards: normalizedBoards, version: 1 };
}

async function getWhiteboardBoardPath(notesRootPath: string, board: WhiteboardIndexEntry): Promise<string> {
  const { boardsPath } = await getWhiteboardStorageTree(notesRootPath);
  return joinPath(boardsPath, board.folder, WHITEBOARD_BOARD_FILE);
}

async function getWhiteboardAssetsPath(notesRootPath: string, board: WhiteboardIndexEntry): Promise<string> {
  const { boardsPath } = await getWhiteboardStorageTree(notesRootPath);
  return joinPath(boardsPath, board.folder, WHITEBOARD_ASSETS_DIR);
}

async function hydrateWhiteboardAssets(
  notesRootPath: string,
  board: WhiteboardIndexEntry,
  snapshot: WhiteboardSnapshot,
): Promise<WhiteboardSnapshot> {
  const elements = await Promise.all(snapshot.elements.map(async (element) => {
    if (element.type !== 'image' || !element.imageAssetPath || element.imageSrc) return element;
    const fileName = getAssetFileName(element.imageAssetPath);
    if (!fileName) return element;
    try {
      const fullPath = await joinPath(await getWhiteboardAssetsPath(notesRootPath, board), fileName);
      return { ...element, imageSrc: await loadImageAsBlob(fullPath) };
    } catch {
      return element;
    }
  }));
  return { ...snapshot, elements };
}

function getAssetFileName(assetPath: string): string | null {
  if (!assetPath.startsWith(`${WHITEBOARD_ASSETS_DIR}/`)) return null;
  const fileName = assetPath.slice(WHITEBOARD_ASSETS_DIR.length + 1);
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName === '.' || fileName === '..') return null;
  return fileName;
}

function normalizeBoardEntry(value: unknown): WhiteboardIndexEntry | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const title = readString(value.title);
  const folder = readSafeFolder(value.folder);
  if (!id || !title || !folder) return null;
  const now = new Date().toISOString();
  return {
    createdAt: readString(value.createdAt) ?? now,
    folder,
    id,
    title,
    updatedAt: readString(value.updatedAt) ?? now,
  };
}

function getAvailableFolder(boards: WhiteboardIndexEntry[], baseFolder: string): string {
  const used = new Set(boards.map((board) => board.folder));
  if (!used.has(baseFolder)) return baseFolder;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${baseFolder}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${baseFolder}-${Date.now()}`;
}

function slugifyWhiteboardTitle(value: string): string {
  return value.trim().toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function readSafeFolder(value: unknown): string | null {
  const folder = readString(value);
  if (!folder || folder.includes('/') || folder.includes('\\') || folder === '.' || folder === '..') return null;
  return folder;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
