import { create } from 'zustand';
import {
  createWhiteboardEntry,
  loadWhiteboardIndex,
  readWhiteboardBoard,
  writeWhiteboardAsset,
  writeWhiteboardBoard,
  writeWhiteboardIndex,
  type WhiteboardIndexEntry,
} from '../model/whiteboardRepository';
import { normalizeWhiteboardSnapshot, type WhiteboardSnapshot } from '../model/whiteboardDocument';

export type WhiteboardSaveResult =
  | { ok: true; byteLength: number }
  | { ok: false; byteLength: number; reason: 'storage-unavailable' | 'write-failed' };

interface WhiteboardStore {
  activeBoardId: string | null;
  activeSnapshot: WhiteboardSnapshot | null;
  boards: WhiteboardIndexEntry[];
  error: string | null;
  loadedNotesRootPath: string | null;
  loading: boolean;
  createBoard: (title?: string) => Promise<void>;
  loadForNotesRoot: (notesRootPath: string | null) => Promise<void>;
  saveActiveSnapshot: (snapshot: WhiteboardSnapshot, boardId?: string | null) => Promise<WhiteboardSaveResult | null>;
  selectBoard: (id: string) => Promise<void>;
  setActiveSnapshotDraft: (snapshot: WhiteboardSnapshot) => void;
  writeActiveAsset: (file: File) => Promise<string | null>;
}

const whiteboardStorageEncoder = new TextEncoder();
let activeSnapshotDraft: { boardId: string | null; snapshot: WhiteboardSnapshot } | null = null;
let whiteboardLoadSequence = 0;
let whiteboardMutationSequence = 0;

export const useWhiteboardStore = create<WhiteboardStore>((set, get) => ({
  activeBoardId: null,
  activeSnapshot: null,
  boards: [],
  error: null,
  loadedNotesRootPath: null,
  loading: false,

  createBoard: async (title = 'Board') => {
    const notesRootPath = get().loadedNotesRootPath;
    if (!notesRootPath) return;
    whiteboardMutationSequence += 1;
    whiteboardLoadSequence += 1;
    set({ loading: true });
    try {
      await flushActiveSnapshot(get);
      const emptySnapshot = normalizeWhiteboardSnapshot({});
      const { entry, index } = await createWhiteboardEntry(notesRootPath, title === 'Board' ? getNextBoardTitle(get().boards) : title);
      activeSnapshotDraft = { boardId: entry.id, snapshot: emptySnapshot };
      set({
        activeBoardId: entry.id,
        activeSnapshot: emptySnapshot,
        boards: index.boards,
        error: null,
        loading: false,
      });
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false });
    }
  },

  loadForNotesRoot: async (notesRootPath) => {
    if (!notesRootPath) {
      set({ activeBoardId: null, activeSnapshot: null, boards: [], loadedNotesRootPath: null, loading: false });
      activeSnapshotDraft = null;
      return;
    }
    if (get().loadedNotesRootPath === notesRootPath && get().boards.length > 0) return;
    const loadSequence = ++whiteboardLoadSequence;
    const mutationSequence = whiteboardMutationSequence;
    set({ loading: true });
    try {
      const index = await loadWhiteboardIndex(notesRootPath);
      const activeBoard = index.boards.find((board) => board.id === index.activeBoardId) ?? index.boards[0];
      const storedSnapshot = await readWhiteboardBoard(notesRootPath, activeBoard);
      const snapshot = storedSnapshot ?? normalizeWhiteboardSnapshot({});
      if (loadSequence !== whiteboardLoadSequence || mutationSequence !== whiteboardMutationSequence) return;
      await writeWhiteboardIndex(notesRootPath, index);
      if (!storedSnapshot) {
        await writeWhiteboardBoard(notesRootPath, activeBoard, snapshot);
      }
      if (loadSequence !== whiteboardLoadSequence || mutationSequence !== whiteboardMutationSequence) return;
      activeSnapshotDraft = { boardId: activeBoard.id, snapshot };
      set({
        activeBoardId: activeBoard.id,
        activeSnapshot: snapshot,
        boards: index.boards,
        error: null,
        loadedNotesRootPath: notesRootPath,
        loading: false,
      });
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false });
    }
  },

  saveActiveSnapshot: async (snapshot, boardId) => {
    const { activeBoardId, boards, loadedNotesRootPath } = get();
    const targetBoardId = boardId ?? activeBoardId;
    const activeBoard = boards.find((board) => board.id === targetBoardId);
    if (!loadedNotesRootPath || !activeBoard) return null;
    try {
      await writeWhiteboardBoard(loadedNotesRootPath, activeBoard, snapshot);
      const updatedBoard = { ...activeBoard, updatedAt: new Date().toISOString() };
      const latestBoards = get().boards;
      const baseBoards = latestBoards.some((board) => board.id === updatedBoard.id) ? latestBoards : boards;
      const nextBoards = baseBoards.map((board) => (board.id === updatedBoard.id ? updatedBoard : board));
      set({ boards: nextBoards });
      const currentActiveBoardId = get().activeBoardId;
      await writeWhiteboardIndex(loadedNotesRootPath, {
        activeBoardId: currentActiveBoardId && nextBoards.some((board) => board.id === currentActiveBoardId)
          ? currentActiveBoardId
          : updatedBoard.id,
        boards: nextBoards,
        version: 1,
      });
      return {
        byteLength: whiteboardStorageEncoder.encode(JSON.stringify(snapshot)).length,
        ok: true,
      };
    } catch (error) {
      set({ error: getErrorMessage(error) });
      return { byteLength: 0, ok: false, reason: 'write-failed' };
    }
  },

  selectBoard: async (id) => {
    const { boards, loadedNotesRootPath } = get();
    if (!loadedNotesRootPath) return;
    const board = boards.find((item) => item.id === id);
    if (!board) return;
    whiteboardMutationSequence += 1;
    whiteboardLoadSequence += 1;
    set({ loading: true });
    try {
      await flushActiveSnapshot(get);
      const index = await loadWhiteboardIndex(loadedNotesRootPath);
      await writeWhiteboardIndex(loadedNotesRootPath, { ...index, activeBoardId: id });
      const snapshot = await readWhiteboardBoard(loadedNotesRootPath, board) ?? normalizeWhiteboardSnapshot({});
      activeSnapshotDraft = { boardId: id, snapshot };
      set({ activeBoardId: id, activeSnapshot: snapshot, error: null, loading: false });
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false });
    }
  },

  setActiveSnapshotDraft: (snapshot) => {
    activeSnapshotDraft = { boardId: get().activeBoardId, snapshot };
  },

  writeActiveAsset: async (file) => {
    const { activeBoardId, boards, loadedNotesRootPath } = get();
    const activeBoard = boards.find((board) => board.id === activeBoardId);
    if (!loadedNotesRootPath || !activeBoard) return null;
    try {
      return await writeWhiteboardAsset(loadedNotesRootPath, activeBoard, file);
    } catch (error) {
      set({ error: getErrorMessage(error) });
      return null;
    }
  },
}));

async function flushActiveSnapshot(get: () => WhiteboardStore): Promise<void> {
  const { activeBoardId, activeSnapshot, boards, loadedNotesRootPath } = get();
  const activeBoard = boards.find((board) => board.id === activeBoardId);
  const snapshot = activeSnapshotDraft?.boardId === activeBoardId ? activeSnapshotDraft.snapshot : activeSnapshot;
  if (!loadedNotesRootPath || !activeBoard || !snapshot) return;
  await writeWhiteboardBoard(loadedNotesRootPath, activeBoard, snapshot);
}

function getNextBoardTitle(boards: WhiteboardIndexEntry[]): string {
  const used = new Set(boards.map((board) => board.title));
  if (!used.has('Board')) return 'Board';
  for (let index = 2; index < 10000; index += 1) {
    const title = `Board ${index}`;
    if (!used.has(title)) return title;
  }
  return `Board ${Date.now()}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Whiteboard storage failed';
}
