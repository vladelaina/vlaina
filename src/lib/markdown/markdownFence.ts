const FENCE_MARKER_RE = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

export type MarkdownFenceState = {
  marker: '`' | '~';
  size: number;
};

export function getMarkdownFenceState(line: string): MarkdownFenceState | null {
  const match = FENCE_MARKER_RE.exec(line);
  if (!match) return null;

  const fence = match[1] ?? '';
  const infoString = (match[2] ?? '').trim();
  const marker = fence[0] as '`' | '~';
  if (marker === '`' && infoString.includes('`')) {
    return null;
  }

  return {
    marker,
    size: fence.length,
  };
}

export function isMarkdownFenceClose(line: string, fence: MarkdownFenceState): boolean {
  const match = FENCE_CLOSE_RE.exec(line);
  if (!match) return false;

  const markerRun = match[1] ?? '';
  return markerRun[0] === fence.marker && markerRun.length >= fence.size;
}
