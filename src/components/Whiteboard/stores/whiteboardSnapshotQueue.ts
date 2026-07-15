import { writeWhiteboardBoard, type WhiteboardIndexEntry } from '../model/whiteboardRepository';
import type { WhiteboardSnapshot } from '../model/whiteboardDocument';

const writes = new Map<string, Promise<void>>();

export function queueWhiteboardSnapshotWrite(
  notesRootPath: string,
  board: WhiteboardIndexEntry,
  snapshot: WhiteboardSnapshot,
): Promise<void> {
  const key = `${notesRootPath}\n${board.folder}`;
  const previous = writes.get(key) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(() => writeWhiteboardBoard(notesRootPath, board, snapshot));
  const tracked = write.finally(() => {
    if (writes.get(key) === tracked) writes.delete(key);
  });
  writes.set(key, tracked);
  return tracked;
}

export async function waitForWhiteboardSnapshotWrites(): Promise<void> {
  await Promise.all(writes.values());
}
