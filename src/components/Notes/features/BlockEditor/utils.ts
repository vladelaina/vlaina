/**
 * Block Editor Utilities
 */

import type { Block, BlockType, DeltaInsert, TextRange } from './types';

// Generate unique block ID
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a new block
export function createBlock(
  type: BlockType = 'paragraph',
  content: string = ''
): Block {
  return {
    id: generateBlockId(),
    type,
    content: content ? [{ insert: content }] : [],
    children: [],
    props: {},
  };
}

// Convert delta to plain text
export function deltaToText(delta: DeltaInsert[]): string {
  return delta.map((d) => d.insert).join('');
}

// Convert plain text to delta
export function textToDelta(text: string): DeltaInsert[] {
  if (!text) return [];
  return [{ insert: text }];
}

// Get text length from delta
export function getDeltaLength(delta: DeltaInsert[]): number {
  return delta.reduce((acc, d) => acc + d.insert.length, 0);
}

// Split delta at position
export function splitDelta(
  delta: DeltaInsert[],
  position: number
): [DeltaInsert[], DeltaInsert[]] {
  const before: DeltaInsert[] = [];
  const after: DeltaInsert[] = [];
  let currentPos = 0;

  for (const d of delta) {
    const len = d.insert.length;
    if (currentPos + len <= position) {
      before.push(d);
    } else if (currentPos >= position) {
      after.push(d);
    } else {
      // Split this delta
      const splitPoint = position - currentPos;
      before.push({
        insert: d.insert.slice(0, splitPoint),
        attributes: d.attributes,
      });
      after.push({
        insert: d.insert.slice(splitPoint),
        attributes: d.attributes,
      });
    }
    currentPos += len;
  }

  return [before, after];
}

// Merge two deltas
export function mergeDelta(
  delta1: DeltaInsert[],
  delta2: DeltaInsert[]
): DeltaInsert[] {
  if (delta1.length === 0) return delta2;
  if (delta2.length === 0) return delta1;

  const result = [...delta1];
  const last = result[result.length - 1];
  const first = delta2[0];

  // Try to merge if attributes match
  if (
    JSON.stringify(last.attributes) === JSON.stringify(first.attributes)
  ) {
    result[result.length - 1] = {
      insert: last.insert + first.insert,
      attributes: last.attributes,
    };
    result.push(...delta2.slice(1));
  } else {
    result.push(...delta2);
  }

  return result;
}

// Apply format to delta range
export function applyFormat(
  delta: DeltaInsert[],
  range: TextRange,
  format: string,
  value: boolean | string
): DeltaInsert[] {
  const result: DeltaInsert[] = [];
  let currentPos = 0;

  for (const d of delta) {
    const len = d.insert.length;
    const start = currentPos;
    const end = currentPos + len;

    if (end <= range.index || start >= range.index + range.length) {
      // Outside range
      result.push(d);
    } else if (start >= range.index && end <= range.index + range.length) {
      // Fully inside range
      result.push({
        insert: d.insert,
        attributes: {
          ...d.attributes,
          [format]: value || undefined,
        },
      });
    } else {
      // Partially inside range
      if (start < range.index) {
        result.push({
          insert: d.insert.slice(0, range.index - start),
          attributes: d.attributes,
        });
      }
      const formatStart = Math.max(0, range.index - start);
      const formatEnd = Math.min(len, range.index + range.length - start);
      result.push({
        insert: d.insert.slice(formatStart, formatEnd),
        attributes: {
          ...d.attributes,
          [format]: value || undefined,
        },
      });
      if (end > range.index + range.length) {
        result.push({
          insert: d.insert.slice(range.index + range.length - start),
          attributes: d.attributes,
        });
      }
    }
    currentPos += len;
  }

  return result;
}

// Get block type from markdown prefix
export function getBlockTypeFromPrefix(prefix: string): BlockType | null {
  const trimmed = prefix.trim();
  
  if (trimmed === '#') return 'heading1';
  if (trimmed === '##') return 'heading2';
  if (trimmed === '###') return 'heading3';
  if (trimmed === '####') return 'heading4';
  if (trimmed === '#####') return 'heading5';
  if (trimmed === '######') return 'heading6';
  if (trimmed === '-' || trimmed === '*') return 'bulletList';
  if (/^\d+\.$/.test(trimmed)) return 'numberedList';
  if (trimmed === '[]' || trimmed === '[ ]') return 'todoList';
  if (trimmed === '[x]' || trimmed === '[X]') return 'todoList';
  if (trimmed === '>') return 'quote';
  if (trimmed === '```') return 'codeBlock';
  if (trimmed === '---' || trimmed === '***' || trimmed === '___') return 'divider';
  
  return null;
}

// Serialize blocks to markdown
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((block) => blockToMarkdown(block)).join('\n');
}

function blockToMarkdown(block: Block): string {
  const text = deltaToText(block.content);
  
  switch (block.type) {
    case 'heading1':
      return `# ${text}`;
    case 'heading2':
      return `## ${text}`;
    case 'heading3':
      return `### ${text}`;
    case 'heading4':
      return `#### ${text}`;
    case 'heading5':
      return `##### ${text}`;
    case 'heading6':
      return `###### ${text}`;
    case 'bulletList':
      return `- ${text}`;
    case 'numberedList':
      return `1. ${text}`;
    case 'todoList':
      return `- [${block.props.checked ? 'x' : ' '}] ${text}`;
    case 'quote':
      return `> ${text}`;
    case 'codeBlock':
      return `\`\`\`${block.props.language || ''}\n${text}\n\`\`\``;
    case 'divider':
      return '---';
    case 'callout':
      return `> [!${block.props.calloutType || 'note'}]\n> ${text}`;
    default:
      return text;
  }
}

// Parse markdown to blocks
export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        ...createBlock('codeBlock', codeLines.join('\n')),
        props: { language },
      });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const type = `heading${level}` as BlockType;
      blocks.push(createBlock(type, headingMatch[2]));
      i++;
      continue;
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(createBlock('divider'));
      i++;
      continue;
    }

    // Todo list
    const todoMatch = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
    if (todoMatch) {
      const block = createBlock('todoList', todoMatch[2]);
      block.props.checked = todoMatch[1].toLowerCase() === 'x';
      blocks.push(block);
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[-*]\s+(.*)$/)) {
      blocks.push(createBlock('bulletList', line.replace(/^[-*]\s+/, '')));
      i++;
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+(.*)$/)) {
      blocks.push(createBlock('numberedList', line.replace(/^\d+\.\s+/, '')));
      i++;
      continue;
    }

    // Quote
    if (line.startsWith('> ')) {
      blocks.push(createBlock('quote', line.slice(2)));
      i++;
      continue;
    }

    // Paragraph (or empty line)
    if (line.trim() || blocks.length === 0) {
      blocks.push(createBlock('paragraph', line));
    }
    i++;
  }

  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push(createBlock('paragraph'));
  }

  return blocks;
}

// Deep clone blocks
export function cloneBlocks(blocks: Block[]): Block[] {
  return JSON.parse(JSON.stringify(blocks));
}

// Inline markdown patterns
// Pattern rules (same as reference):
// - convert: **text** + space
// - convert: **t ext** + space
// - not convert: ** text** + space (space after opening)
// - not convert: **text ** + space (space before closing)
export interface InlineMarkdownMatch {
  type: 'bold' | 'italic' | 'boldItalic' | 'code' | 'strikethrough';
  startIndex: number;
  endIndex: number;
  content: string;
  markerLength: number;
}

// Check for inline markdown patterns when space is typed
export function checkInlineMarkdown(text: string): InlineMarkdownMatch | null {
  // Must end with space
  if (!text.endsWith(' ')) return null;
  
  const prefixText = text.slice(0, -1); // Remove trailing space
  
  // Bold + Italic: ***text***
  const boldItalicMatch = prefixText.match(/\*{3}([^\s*][^*]*[^\s*])\*{3}$|\*{3}([^\s*])\*{3}$/);
  if (boldItalicMatch) {
    const content = boldItalicMatch[1] ?? boldItalicMatch[2];
    const fullMatch = boldItalicMatch[0];
    return {
      type: 'boldItalic',
      startIndex: prefixText.length - fullMatch.length,
      endIndex: prefixText.length,
      content,
      markerLength: 3,
    };
  }
  
  // Bold: **text**
  const boldMatch = prefixText.match(/\*{2}([^\s][^*]*[^\s*])\*{2}$|\*{2}([^\s*])\*{2}$/);
  if (boldMatch) {
    const content = boldMatch[1] ?? boldMatch[2];
    const fullMatch = boldMatch[0];
    return {
      type: 'bold',
      startIndex: prefixText.length - fullMatch.length,
      endIndex: prefixText.length,
      content,
      markerLength: 2,
    };
  }
  
  // Italic: *text*
  const italicMatch = prefixText.match(/\*{1}([^\s][^*]*[^\s*])\*{1}$|\*{1}([^\s*])\*{1}$/);
  if (italicMatch) {
    const content = italicMatch[1] ?? italicMatch[2];
    const fullMatch = italicMatch[0];
    return {
      type: 'italic',
      startIndex: prefixText.length - fullMatch.length,
      endIndex: prefixText.length,
      content,
      markerLength: 1,
    };
  }
  
  // Strikethrough: ~~text~~
  const strikeMatch = prefixText.match(/~{2}([^\s][^~]*[^\s])~{2}$|~{2}([^\s~])~{2}$/);
  if (strikeMatch) {
    const content = strikeMatch[1] ?? strikeMatch[2];
    const fullMatch = strikeMatch[0];
    return {
      type: 'strikethrough',
      startIndex: prefixText.length - fullMatch.length,
      endIndex: prefixText.length,
      content,
      markerLength: 2,
    };
  }
  
  // Inline code: `text`
  const codeMatch = prefixText.match(/`([^\s][^`]*[^\s])`$|`([^\s`])`$/);
  if (codeMatch) {
    const content = codeMatch[1] ?? codeMatch[2];
    const fullMatch = codeMatch[0];
    return {
      type: 'code',
      startIndex: prefixText.length - fullMatch.length,
      endIndex: prefixText.length,
      content,
      markerLength: 1,
    };
  }
  
  return null;
}

// Apply inline format to delta
export function applyInlineMarkdownFormat(
  delta: DeltaInsert[],
  match: InlineMarkdownMatch
): DeltaInsert[] {
  const text = deltaToText(delta);
  
  // Build new delta with format applied
  const result: DeltaInsert[] = [];
  
  // Text before the match
  if (match.startIndex > 0) {
    result.push({ insert: text.slice(0, match.startIndex) });
  }
  
  // Formatted content (without markers)
  const attributes: Record<string, boolean> = {};
  switch (match.type) {
    case 'bold':
      attributes.bold = true;
      break;
    case 'italic':
      attributes.italic = true;
      break;
    case 'boldItalic':
      attributes.bold = true;
      attributes.italic = true;
      break;
    case 'strikethrough':
      attributes.strike = true;
      break;
    case 'code':
      attributes.code = true;
      break;
  }
  
  result.push({
    insert: match.content,
    attributes,
  });
  
  // Text after the match (should be empty since we match at end)
  if (match.endIndex < text.length) {
    result.push({ insert: text.slice(match.endIndex) });
  }
  
  return result;
}

// Find block by ID
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const found = findBlockById(block.children, id);
    if (found) return found;
  }
  return null;
}

// Find block index
export function findBlockIndex(blocks: Block[], id: string): number {
  return blocks.findIndex((b) => b.id === id);
}

// Get previous block
export function getPreviousBlock(blocks: Block[], id: string): Block | null {
  const index = findBlockIndex(blocks, id);
  if (index <= 0) return null;
  return blocks[index - 1];
}

// Get next block
export function getNextBlock(blocks: Block[], id: string): Block | null {
  const index = findBlockIndex(blocks, id);
  if (index === -1 || index >= blocks.length - 1) return null;
  return blocks[index + 1];
}
