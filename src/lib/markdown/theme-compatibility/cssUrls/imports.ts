import postcss from 'postcss';
import type { MarkdownThemeCssImport } from './types';
import { isRelativeCssAssetUrl, splitCssUrlSuffix } from './urlIdentity';

export function stripCssImportRules(css: string): string {
  try {
    const root = postcss.parse(css, { from: undefined });
    root.walkAtRules((rule) => {
      if (rule.name.toLowerCase() === 'import') {
        rule.remove();
      }
    });
    return root.toString();
  } catch {
    return stripCssImportRulesFallback(css);
  }
}

export function getRelativeMarkdownThemeCssImports(css: string): MarkdownThemeCssImport[] {
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: undefined });
  } catch {
    return [];
  }
  const imports: MarkdownThemeCssImport[] = [];

  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() !== 'import') return;

    const url = getCssImportUrl(rule.params);
    if (!url || !isRelativeCssAssetUrl(url)) return;

    const { path, suffix } = splitCssUrlSuffix(url);
    if (!path.toLowerCase().endsWith('.css')) return;

    imports.push({ url, path, suffix });
  });

  return imports;
}

function getCssImportUrl(params: string): string | null {
  const trimmed = params.trim();
  const urlFunctionMatch = trimmed.match(/^url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s][^)]*?))\s*\)/i);
  if (urlFunctionMatch) {
    return (urlFunctionMatch[1] ?? urlFunctionMatch[2] ?? urlFunctionMatch[3] ?? '').trim() || null;
  }

  const quotedMatch = trimmed.match(/^"([^"]+)"|^'([^']+)'/);
  return (quotedMatch?.[1] ?? quotedMatch?.[2] ?? '').trim() || null;
}

function stripCssImportRulesFallback(css: string): string {
  let output = '';
  let cursor = 0;
  let quote: string | null = null;
  let escaped = false;
  let inComment = false;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (css.slice(index, index + 7).toLowerCase() !== '@import') {
      continue;
    }

    const afterImport = css[index + 7] ?? '';
    if (afterImport && /[-_a-z0-9]/i.test(afterImport)) {
      continue;
    }

    output += css.slice(cursor, index);
    const ruleEnd = findCssImportRuleEnd(css, index + 7);
    cursor = ruleEnd;
    index = ruleEnd - 1;
  }

  return output + css.slice(cursor);
}

function findCssImportRuleEnd(css: string, start: number): number {
  let quote: string | null = null;
  let escaped = false;
  let inComment = false;

  for (let index = start; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ';') {
      return index + 1;
    }
  }

  return css.length;
}
