import postcss from 'postcss';
import type { MarkdownThemeCssImport } from './types';
import { isRelativeCssAssetUrl, splitCssUrlSuffix } from './urlIdentity';

export function stripCssImportRules(css: string): string {
  const root = postcss.parse(css, { from: undefined });
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === 'import') {
      rule.remove();
    }
  });
  return root.toString();
}

export function getRelativeMarkdownThemeCssImports(css: string): MarkdownThemeCssImport[] {
  const root = postcss.parse(css, { from: undefined });
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
