const FRONTMATTER_DELIMITER_PATTERN = /^\s*---\s*$/;

export function normalizeMermaidDiagramDirective(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

export function getFirstMermaidDirective(code: string) {
  const lines = code.split(/\r?\n/);
  let index = 0;

  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  if (FRONTMATTER_DELIMITER_PATTERN.test(lines[index] ?? '')) {
    index += 1;
    while (index < lines.length && !FRONTMATTER_DELIMITER_PATTERN.test(lines[index])) {
      index += 1;
    }
    if (index < lines.length) {
      index += 1;
    }
  }

  let inDirectiveComment = false;
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }

    if (inDirectiveComment) {
      inDirectiveComment = !line.includes('}%%');
      continue;
    }

    if (line.startsWith('%%{')) {
      inDirectiveComment = !line.includes('}%%');
      continue;
    }

    if (line.startsWith('%%')) {
      continue;
    }

    const [directive = ''] = line.split(/\s+/);
    return normalizeMermaidDiagramDirective(directive);
  }

  return '';
}

export function getMermaidCodeForLooseSyntaxScan(code: string) {
  const lines = code.split(/\r?\n/);
  let index = 0;

  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  if (FRONTMATTER_DELIMITER_PATTERN.test(lines[index] ?? '')) {
    index += 1;
    while (index < lines.length && !FRONTMATTER_DELIMITER_PATTERN.test(lines[index])) {
      index += 1;
    }
    if (index < lines.length) {
      index += 1;
    }
  }

  const syntaxLines: string[] = [];
  let inDirectiveComment = false;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (inDirectiveComment) {
      inDirectiveComment = !trimmedLine.includes('}%%');
      continue;
    }

    if (trimmedLine.startsWith('%%{')) {
      inDirectiveComment = !trimmedLine.includes('}%%');
      continue;
    }

    if (trimmedLine.startsWith('%%')) {
      continue;
    }

    syntaxLines.push(line);
  }

  return syntaxLines.join('\n');
}
