interface AutolinkReference {
  raw: string;
  value: string;
}

interface MarkdownLine {
  protected: boolean;
  text: string;
}

const AUTOLINK_PATTERN =
  /<((?:https?:\/\/|mailto:)[^\s<>"']+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)>/gi;
const SAME_EMAIL_MAILTO_LINK_PATTERN =
  /(^|[^!])\[([A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)\]\(mailto:([A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)\)/gi;
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

export function restoreAutolinkStyleFromReference(
  markdown: string,
  referenceMarkdown?: string,
): string {
  if (!referenceMarkdown) return markdown;

  const references = collectAutolinkReferences(referenceMarkdown);
  if (references.length === 0) return markdown;

  const lines = collectMarkdownLines(markdown);
  let changed = false;
  for (const reference of references) {
    const didReplace = replaceFirstPlainValue(lines, reference.value, reference.raw);
    if (didReplace) {
      changed = true;
    }
  }
  return changed ? lines.map((line) => line.text).join('\n') : markdown;
}

function collectAutolinkReferences(markdown: string): AutolinkReference[] {
  const references: AutolinkReference[] = [];
  const lines = collectMarkdownLines(markdown);
  const searchableMarkdown = lines
    .filter((line) => !line.protected)
    .map((line) => line.text)
    .join('\n');

  for (const match of searchableMarkdown.matchAll(AUTOLINK_PATTERN)) {
    const raw = match[0] ?? '';
    const value = match[1] ?? '';
    if (raw && value) {
      references.push({ raw, value });
    }
  }

  for (const match of searchableMarkdown.matchAll(SAME_EMAIL_MAILTO_LINK_PATTERN)) {
    const raw = match[0]?.slice((match[1] ?? '').length) ?? '';
    const label = match[2] ?? '';
    const destination = match[3] ?? '';
    if (raw && label && label.toLowerCase() === destination.toLowerCase()) {
      references.push({ raw, value: label });
    }
  }

  return references;
}

function collectMarkdownLines(markdown: string): MarkdownLine[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let activeFence: { marker: string; length: number } | null = null;
  let inLeadingFrontmatter = FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? '');

  return lines.map((text, index) => {
    if (inLeadingFrontmatter) {
      const isClosingDelimiter = index > 0 && FRONTMATTER_DELIMITER_PATTERN.test(text);
      if (isClosingDelimiter) {
        inLeadingFrontmatter = false;
      }
      return { protected: true, text };
    }

    const fence = parseFenceLine(text);
    if (activeFence) {
      const isClosingFence = fence
        && fence.marker === activeFence.marker
        && fence.length >= activeFence.length
        && text.slice(fence.infoStart).trim() === '';
      if (isClosingFence) {
        activeFence = null;
      }
      return { protected: true, text };
    }

    if (fence) {
      activeFence = { marker: fence.marker, length: fence.length };
      return { protected: true, text };
    }

    return { protected: false, text };
  });
}

function replaceFirstPlainValue(lines: MarkdownLine[], value: string, raw: string): boolean {
  for (const line of lines) {
    if (line.protected) continue;

    let searchStart = 0;
    while (searchStart < line.text.length) {
      const index = line.text.indexOf(value, searchStart);
      if (index < 0) break;

      if (isPlainValueOccurrence(line.text, index, value, raw)) {
        line.text = `${line.text.slice(0, index)}${raw}${line.text.slice(index + value.length)}`;
        return true;
      }

      searchStart = index + value.length;
    }
  }

  return false;
}

function isPlainValueOccurrence(line: string, index: number, value: string, raw: string): boolean {
  if (line.slice(index, index + raw.length) === raw) return false;
  if (isInsideInlineCode(line, index)) return false;

  const before = line[index - 1] ?? '';
  const after = line[index + value.length] ?? '';
  if (before === '<' || after === '>') return false;
  if (before === '(' || before === '[' || after === ')' || after === ']') return false;
  if (isValueContinuation(before) || isValueContinuation(after)) return false;

  return true;
}

function isInsideInlineCode(line: string, index: number): boolean {
  let open = false;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (line[cursor] !== '`' || line[cursor - 1] === '\\') continue;
    open = !open;
  }
  return open;
}

function isValueContinuation(char: string): boolean {
  return /[A-Za-z0-9_/@%+~#=&-]/.test(char);
}

function parseFenceLine(line: string): { infoStart: number; length: number; marker: string } | null {
  let cursor = 0;
  while (cursor < line.length && cursor <= 3 && line[cursor] === ' ') {
    cursor += 1;
  }
  if (cursor > 3) return null;

  const marker = line[cursor];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (line[cursor + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return { infoStart: cursor + length, length, marker };
}
