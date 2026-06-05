import katex from 'katex';
import { translate } from '@/lib/i18n';
import { KATEX_SHARED_RENDER_OPTIONS } from '@/components/common/markdown/katexOptions';
import { removeKatexSourceAnnotationsFromHtml } from '@/components/common/markdown/katexSourceSanitizer';
import 'katex/contrib/mhchem';

const MAX_LATEX_CHARS = 10000;
const MAX_RENDER_CACHE_ENTRIES = 500;
const KATEX_RENDER_OPTIONS = {
  ...KATEX_SHARED_RENDER_OPTIONS,
  throwOnError: true,
} as const;
const successfulRenderCache = new Map<string, RenderResult>();

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMathErrorHtml() {
  return `<span class="math-error">${escapeHtmlText(translate('editor.errorEquation'))}</span>`;
}

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

function createRenderCacheKey(latex: string, displayMode: boolean) {
  return `${displayMode ? 'block' : 'inline'}\u0000${latex}`;
}

function readCachedRenderResult(latex: string, displayMode: boolean) {
  const key = createRenderCacheKey(latex, displayMode);
  const cached = successfulRenderCache.get(key);
  if (!cached) {
    return null;
  }

  successfulRenderCache.delete(key);
  successfulRenderCache.set(key, cached);
  return cached;
}

function cacheSuccessfulRenderResult(
  latex: string,
  displayMode: boolean,
  result: RenderResult
) {
  if (result.error !== null) {
    return result;
  }

  successfulRenderCache.set(createRenderCacheKey(latex, displayMode), result);
  while (successfulRenderCache.size > MAX_RENDER_CACHE_ENTRIES) {
    const oldestKey = successfulRenderCache.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }
    successfulRenderCache.delete(oldestKey);
  }
  return result;
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

  if (latex.length > MAX_LATEX_CHARS) {
    return {
      html: renderMathErrorHtml(),
      error: 'Equation is too large to render',
      errorDetails: {
        rawMessage: 'Equation is too large to render',
        summary: 'Equation is too large to render',
        position: null,
        line: null,
        column: null,
        locationLabel: null,
        context: null,
        pointer: null,
      },
    };
  }

  const cached = readCachedRenderResult(latex, displayMode);
  if (cached) {
    return cached;
  }

  try {
    const html = removeKatexSourceAnnotationsFromHtml(katex.renderToString(latex, {
      ...KATEX_RENDER_OPTIONS,
      displayMode,
    }));
    return cacheSuccessfulRenderResult(latex, displayMode, {
      html,
      error: null,
      errorDetails: null,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorDetails = parseMathRenderError(errorMessage, latex);
    return {
      html: renderMathErrorHtml(),
      error: errorDetails.summary,
      errorDetails,
    };
  }
}

export function isValidLatex(latex: string): boolean {
  if (!latex.trim()) {
    return true;
  }
  if (latex.length > MAX_LATEX_CHARS) {
    return false;
  }

  try {
    katex.renderToString(latex, {
      ...KATEX_RENDER_OPTIONS,
      displayMode: true,
    });
    return true;
  } catch {
    return false;
  }
}
