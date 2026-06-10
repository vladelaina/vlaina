import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import '@/components/common/markdown/markdownSurface.css';

export type FirstPaintPreviewBlock = {
  key: string;
  type: 'heading' | 'paragraph';
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
};

const LARGE_MARKDOWN_FIRST_PAINT_PREVIEW_MIN_LENGTH = 1_000_000;
const FIRST_PAINT_PREVIEW_MAX_BLOCKS = 6;
const FIRST_PAINT_PREVIEW_SCAN_CHAR_LIMIT = 80_000;
const FIRST_PAINT_PREVIEW_TEXT_CHAR_LIMIT = 2_400;
const FIRST_PAINT_PREVIEW_HEADING_PATTERN = /^(#{1,6})[ \t]+(.+)$/;
const FIRST_PAINT_PREVIEW_BLANK_LINE_COMMENT = '<!--vlaina-markdown-blank-line-->';

function truncatePreviewText(text: string): string {
  if (text.length <= FIRST_PAINT_PREVIEW_TEXT_CHAR_LIMIT) {
    return text;
  }

  return `${text.slice(0, FIRST_PAINT_PREVIEW_TEXT_CHAR_LIMIT).trimEnd()}...`;
}

function normalizePreviewHeadingText(text: string): string {
  return text.replace(/[ \t]+#+[ \t]*$/, '').trimEnd();
}

export function createLargeMarkdownFirstPaintPreviewBlocks(markdown: string): FirstPaintPreviewBlock[] {
  if (markdown.length < LARGE_MARKDOWN_FIRST_PAINT_PREVIEW_MIN_LENGTH) {
    return [];
  }

  const blocks: FirstPaintPreviewBlock[] = [];
  let lineStart = 0;
  let lineIndex = 0;
  const scanLimit = Math.min(markdown.length, FIRST_PAINT_PREVIEW_SCAN_CHAR_LIMIT);

  while (lineStart < scanLimit && blocks.length < FIRST_PAINT_PREVIEW_MAX_BLOCKS) {
    const nextBreak = markdown.indexOf('\n', lineStart);
    const lineEnd = nextBreak === -1 ? scanLimit : Math.min(nextBreak, scanLimit);
    const rawLine = markdown.slice(lineStart, lineEnd);
    const line = rawLine.trim();
    if (line && line !== FIRST_PAINT_PREVIEW_BLANK_LINE_COMMENT) {
      const headingMatch = FIRST_PAINT_PREVIEW_HEADING_PATTERN.exec(rawLine);
      if (headingMatch) {
        blocks.push({
          key: `h-${lineIndex}`,
          type: 'heading',
          level: Math.min(6, headingMatch[1]?.length ?? 1) as FirstPaintPreviewBlock['level'],
          text: truncatePreviewText(normalizePreviewHeadingText(headingMatch[2] ?? '')),
        });
      } else {
        blocks.push({
          key: `p-${lineIndex}`,
          type: 'paragraph',
          text: truncatePreviewText(rawLine.trimEnd()),
        });
      }
    }

    if (nextBreak === -1 || nextBreak >= scanLimit) {
      break;
    }
    lineStart = nextBreak + 1;
    lineIndex += 1;
  }

  return blocks;
}

export function LargeMarkdownFirstPaintPreview({ blocks }: { blocks: FirstPaintPreviewBlock[] }) {
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'milkdown-editor theme-vlaina is-live-preview max is-readable-line-width pointer-events-none bg-[var(--vlaina-bg-primary)]',
        EDITOR_LAYOUT_CLASS
      )}
      data-note-first-paint-preview="true"
    >
      <div className="markdown-surface notes-long-doc-first-paint-preview">
        {blocks.map((block) => {
          if (block.type === 'heading') {
            const Heading = `h${block.level ?? 1}` as keyof JSX.IntrinsicElements;
            return (
              <Heading key={block.key} data-note-preview-block="heading">
                {block.text}
              </Heading>
            );
          }

          return (
            <p key={block.key} data-note-preview-block="paragraph">
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
