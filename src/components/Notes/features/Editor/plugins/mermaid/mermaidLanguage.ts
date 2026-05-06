export const MERMAID_FENCE_LANGUAGE_ALIAS_LIST = [
  'mermaid',
  'mmd',
  'info',
  'c4',
  'c4context',
  'c4container',
  'c4component',
  'c4dynamic',
  'c4deployment',
  'flow',
  'flowchart',
  'flowchartv2',
  'flowchartelk',
  'graph',
  'sequence',
  'sequencediagram',
  'class',
  'classdiagram',
  'classdiagramv2',
  'state',
  'statediagram',
  'statediagramv2',
  'er',
  'erdiagram',
  'gantt',
  'pie',
  'journey',
  'gitgraph',
  'mindmap',
  'timeline',
  'treeview',
  'treeviewbeta',
  'quadrant',
  'quadrantchart',
  'xychart',
  'xychartbeta',
  'requirement',
  'requirementdiagram',
  'sankey',
  'sankeybeta',
  'packet',
  'packetbeta',
  'radar',
  'radarbeta',
  'block',
  'blockbeta',
  'architecture',
  'architecturebeta',
  'kanban',
  'ishikawa',
  'ishikawabeta',
  'venn',
  'vennbeta',
  'treemap',
  'treemapbeta',
  'wardley',
  'wardleybeta',
  'zenuml',
] as const;

const MERMAID_FENCE_LANGUAGE_ALIASES: ReadonlySet<string> = new Set(
  MERMAID_FENCE_LANGUAGE_ALIAS_LIST
);

const MERMAID_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\r\n]*)$/;

export function normalizeMermaidFenceLanguage(language: string | null | undefined) {
  const languageToken = language?.trim().split(/\s+/)[0] ?? '';
  return languageToken.toLowerCase().replace(/[\s_-]+/g, '');
}

export function isMermaidFenceLanguage(language: string | null | undefined) {
  return MERMAID_FENCE_LANGUAGE_ALIASES.has(normalizeMermaidFenceLanguage(language));
}

export function parseMermaidFenceLanguage(text: string) {
  const match = MERMAID_FENCE_PATTERN.exec(text.replace(/[ \t]+$/g, ''));
  if (!match) {
    return null;
  }

  const openingMarker = match[1] ?? '';
  const infoString = match[2]?.trim() ?? '';
  if (openingMarker[0] === '`' && infoString.includes('`')) {
    return null;
  }

  const language = infoString.split(/\s+/)[0] ?? '';
  return isMermaidFenceLanguage(language) ? language : null;
}
