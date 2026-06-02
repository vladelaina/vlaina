export type EscapedMarkdownBlockSyntax =
  | 'toc'
  | 'definitionListDescription'
  | 'abbrDefinition';

const ESCAPED_BLOCK_SYNTAX_VALUES = new Set<EscapedMarkdownBlockSyntax>([
  'toc',
  'definitionListDescription',
  'abbrDefinition',
]);

export interface MdastEscapedBlockSyntaxData {
  data?: {
    vlainaEscapedBlockSyntax?: unknown;
  };
}

export function normalizeEscapedMarkdownBlockSyntax(
  value: unknown
): EscapedMarkdownBlockSyntax | null {
  return typeof value === 'string' && ESCAPED_BLOCK_SYNTAX_VALUES.has(value as EscapedMarkdownBlockSyntax)
    ? (value as EscapedMarkdownBlockSyntax)
    : null;
}

export function readEscapedMarkdownBlockSyntax(
  node: MdastEscapedBlockSyntaxData
): EscapedMarkdownBlockSyntax | null {
  return normalizeEscapedMarkdownBlockSyntax(node.data?.vlainaEscapedBlockSyntax);
}

export function markEscapedMarkdownBlockSyntax(
  node: MdastEscapedBlockSyntaxData,
  syntax: EscapedMarkdownBlockSyntax
): void {
  node.data = {
    ...(node.data || {}),
    vlainaEscapedBlockSyntax: syntax,
  };
}

export function getMdastEscapedBlockSyntax(
  parent: unknown
): EscapedMarkdownBlockSyntax | null {
  if (!parent || typeof parent !== 'object') return null;
  const node = parent as {
    data?: { vlainaEscapedBlockSyntax?: unknown };
    vlainaEscapedBlockSyntax?: unknown;
  };
  return normalizeEscapedMarkdownBlockSyntax(
    node.data?.vlainaEscapedBlockSyntax ?? node.vlainaEscapedBlockSyntax
  );
}

export function protectEscapedMarkdownBlockSyntaxText(
  value: string,
  syntax: EscapedMarkdownBlockSyntax | null
): string {
  if (!syntax) return value;

  if (syntax === 'toc') {
    return value.replace(
      /^([ \t]*)\\?(\[toc\]|\{:toc\})([ \t]*)$/i,
      '$1\\$2$3'
    );
  }

  if (syntax === 'definitionListDescription') {
    return value.replace(/(^|\n)([ \t]*)\\?:(?=\s|$)/g, '$1$2\\:');
  }

  return value.replace(
    /(^|\n)([ \t]*)\\?\*\\?\[([^\]\n]+)]\\?:(?=\s|$)/g,
    '$1$2\\*[$3]:'
  );
}
