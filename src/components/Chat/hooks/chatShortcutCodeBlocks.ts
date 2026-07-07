import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from '@/components/Chat/features/Layout/chatAssistantMarkdownBlockParser';

export const MAX_CHAT_SHORTCUT_CODE_BLOCK_SCAN_CHARS = 256 * 1024;
export const MAX_CHAT_SHORTCUT_CODE_BLOCK_COPY_CHARS = 256 * 1024;

export function extractLastFencedCodeBlock(markdown: string): string | null {
  let activeFence: MarkdownFenceState | null = null;
  let activeCodeLines: string[] = [];
  let activeCodeChars = 0;
  let activeCodeOversized = false;
  let lastCodeBlock: string | null = null;
  const scanStart = getMarkdownTailScanStart(markdown, MAX_CHAT_SHORTCUT_CODE_BLOCK_SCAN_CHARS);

  forEachNormalizedMarkdownLine(markdown, (line) => {
    if (activeFence) {
      if (isMarkdownFenceClose(line, activeFence)) {
        if (!activeCodeOversized) {
          lastCodeBlock = activeCodeLines.join('\n');
        }
        activeFence = null;
        activeCodeLines = [];
        activeCodeChars = 0;
        activeCodeOversized = false;
        return;
      }

      activeCodeChars += line.length + (activeCodeLines.length > 0 ? 1 : 0);
      if (activeCodeChars <= MAX_CHAT_SHORTCUT_CODE_BLOCK_COPY_CHARS) {
        activeCodeLines.push(line);
      } else {
        activeCodeLines = [];
        activeCodeOversized = true;
      }
      return;
    }

    const fence = getMarkdownFenceState(line);
    if (fence) {
      activeFence = fence;
      activeCodeLines = [];
      activeCodeChars = 0;
      activeCodeOversized = false;
    }
  }, scanStart);

  return lastCodeBlock;
}

function getMarkdownTailScanStart(markdown: string, maxScanChars: number): number {
  if (markdown.length <= maxScanChars) {
    return 0;
  }
  const start = markdown.length - maxScanChars;
  const newline = markdown.indexOf('\n', start);
  return newline >= 0 ? newline + 1 : start;
}

function forEachNormalizedMarkdownLine(markdown: string, visit: (line: string) => void, start = 0): void {
  let lineStart = Math.max(0, Math.min(start, markdown.length));
  for (let index = lineStart; index < markdown.length; index += 1) {
    const character = markdown[index];
    if (character !== '\n' && character !== '\r') continue;

    visit(markdown.slice(lineStart, index));
    if (character === '\r' && markdown[index + 1] === '\n') {
      index += 1;
    }
    lineStart = index + 1;
  }
  visit(markdown.slice(lineStart));
}
