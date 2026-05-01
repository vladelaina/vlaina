import { measureTextBlockHeight } from '@/lib/text-layout';
import type { NotesSidebarSearchResult } from './notesSidebarSearchResults';

const TITLE_FONT = 'normal 400 16px Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const META_FONT = 'normal 400 16px Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const SNIPPET_FONT = 'normal 400 16px Inter, -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const TITLE_LINE_HEIGHT = 22;
const META_LINE_HEIGHT = 22;
const SNIPPET_LINE_HEIGHT = 22;
const SIDEBAR_ROW_HORIZONTAL_PADDING = 12;
const SIDEBAR_ROW_VERTICAL_PADDING = 8;
const SIDEBAR_ROW_ICON_WIDTH = 20;
const SIDEBAR_ROW_GAP = 8;
const SIDEBAR_ROW_TRAILING_RESERVE = 8;
const SIDEBAR_ROW_MIN_HEIGHT = 36;
const SIDEBAR_ROW_LOCATION_MIN_HEIGHT = 60;
const SIDEBAR_ROW_CONTENT_MIN_HEIGHT = 82;

export interface NotesSidebarSearchLayoutItem {
  result: NotesSidebarSearchResult;
  showFileHeader: boolean;
}

function resolveContentWidth(containerWidth: number) {
  return Math.max(
    80,
    Math.floor(
      containerWidth
        - SIDEBAR_ROW_HORIZONTAL_PADDING * 2
        - SIDEBAR_ROW_ICON_WIDTH
        - SIDEBAR_ROW_GAP
        - SIDEBAR_ROW_TRAILING_RESERVE,
    ),
  );
}

function estimateTextLineHeight(text: string, width: number, font: string, lineHeight: number) {
  if (!text) {
    return 0;
  }

  return measureTextBlockHeight(text, width, {
    font,
    lineHeight,
    minHeight: lineHeight,
  });
}

export function buildNotesSidebarSearchLayoutItems(
  results: NotesSidebarSearchResult[],
): NotesSidebarSearchLayoutItem[] {
  let previousPath: string | null = null;

  return results.map((result) => {
    const showFileHeader = previousPath !== result.path;
    previousPath = result.path;
    return {
      result,
      showFileHeader,
    };
  });
}

export function estimateNotesSidebarSearchRowHeight(
  item: NotesSidebarSearchLayoutItem,
  containerWidth: number,
): number {
  const width = resolveContentWidth(containerWidth);
  const locationLabel = item.result.preview.replace(/\/$/, '');
  const titleHeight = item.showFileHeader
    ? estimateTextLineHeight(item.result.name, width, TITLE_FONT, TITLE_LINE_HEIGHT)
    : 0;
  const locationHeight = locationLabel
    ? estimateTextLineHeight(locationLabel, width, META_FONT, META_LINE_HEIGHT)
    : 0;
  const contentHeight = item.result.contentSnippet
    ? estimateTextLineHeight(item.result.contentSnippet, width, SNIPPET_FONT, SNIPPET_LINE_HEIGHT)
    : 0;
  const textHeight = titleHeight + locationHeight + contentHeight;
  const paddedHeight = textHeight + SIDEBAR_ROW_VERTICAL_PADDING * 2;
  const minimumHeight = item.result.contentSnippet
    ? SIDEBAR_ROW_CONTENT_MIN_HEIGHT
    : locationLabel
      ? SIDEBAR_ROW_LOCATION_MIN_HEIGHT
      : SIDEBAR_ROW_MIN_HEIGHT;

  return Math.max(minimumHeight, paddedHeight);
}
