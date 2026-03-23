import katex from 'katex';

export interface MathRenderErrorDetails {
  rawMessage: string;
  summary: string;
  position: number | null;
  line: number | null;
  column: number | null;
  locationLabel: string | null;
  context: string | null;
  pointer: string | null;
}

export interface RenderResult {
  html: string;
  error: string | null;
  errorDetails: MathRenderErrorDetails | null;
}

function extractKatexErrorSummary(message: string) {
  const normalized = message.replace(/^KaTeX parse error:\s*/i, '');
  const positionIndex = normalized.indexOf(' at position ');
  if (positionIndex >= 0) {
    return normalized.slice(0, positionIndex).trim();
  }

  return normalized.trim();
}

function resolveErrorLocation(latex: string, position: number | null) {
  if (!latex || position == null) {
    return {
      line: null,
      column: null,
      lineText: null,
    };
  }

  const zeroBasedIndex = Math.max(0, Math.min(latex.length - 1, position - 1));
  let line = 1;
  let column = 1;
  let lineStart = 0;

  for (let index = 0; index < zeroBasedIndex; index += 1) {
    const char = latex[index];
    if (char === '\r') {
      if (latex[index + 1] === '\n') {
        continue;
      }
      line += 1;
      column = 1;
      lineStart = index + 1;
      continue;
    }

    if (char === '\n') {
      line += 1;
      column = 1;
      lineStart = index + 1;
      continue;
    }

    column += 1;
  }

  let lineEnd = latex.length;
  for (let index = lineStart; index < latex.length; index += 1) {
    const char = latex[index];
    if (char === '\r' || char === '\n') {
      lineEnd = index;
      break;
    }
  }

  return {
    line,
    column,
    lineText: latex.slice(lineStart, lineEnd),
  };
}

function buildErrorContext(args: {
  line: number | null;
  column: number | null;
  lineText: string | null;
}) {
  const { line, column, lineText } = args;

  if (line == null || column == null || lineText == null) {
    return { context: null, pointer: null };
  }

  const gutter = `${line} | `;

  return {
    context: `${gutter}${lineText}`,
    pointer: `${' '.repeat(gutter.length + column - 1)}^`,
  };
}

function formatLocationLabel(line: number | null, column: number | null) {
  if (line == null || column == null) {
    return null;
  }

  return `Line ${line}, column ${column}`;
}

function buildErrorMetadata(latex: string, position: number | null) {
  if (!latex || position == null) {
    return {
      line: null,
      column: null,
      context: null,
      pointer: null,
      locationLabel: null,
    };
  }

  const location = resolveErrorLocation(latex, position);
  const { context, pointer } = buildErrorContext(location);

  return {
    line: location.line,
    column: location.column,
    context,
    pointer,
    locationLabel: formatLocationLabel(location.line, location.column),
  };
}

export function parseMathRenderError(
  message: string,
  latex: string
): MathRenderErrorDetails {
  const positionMatch = message.match(/ at position (\d+)/i);
  const position = positionMatch ? Number.parseInt(positionMatch[1], 10) : null;
  const summary = extractKatexErrorSummary(message);
  const { line, column, context, pointer, locationLabel } = buildErrorMetadata(
    latex,
    position
  );

  return {
    rawMessage: message,
    summary,
    position,
    line,
    column,
    locationLabel,
    context,
    pointer,
  };
}

export function renderLatex(latex: string, displayMode: boolean): RenderResult {
  if (!latex.trim()) {
    return {
      html: '<span class="math-empty" aria-hidden="true">\u200b</span>',
      error: null,
      errorDetails: null,
    };
  }

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: false,
      trust: false,
      macros: {
        '\\R': '\\mathbb{R}',
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
        '\\C': '\\mathbb{C}'
      }
    });
    return { html, error: null, errorDetails: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorDetails = parseMathRenderError(errorMessage, latex);
    return {
      html: `<span class="math-error">Error equation</span>`,
      error: errorDetails.summary,
      errorDetails,
    };
  }
}

export function isValidLatex(latex: string): boolean {
  if (!latex.trim()) return true;
  
  try {
    katex.renderToString(latex, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}
