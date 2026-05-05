export const MERMAID_FENCE_LANGUAGE_ALIAS_LIST = [
  'mermaid',
  'mmd',
  'c4',
  'c4context',
  'c4container',
  'c4component',
  'c4dynamic',
  'c4deployment',
  'flow',
  'flowchart',
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
] as const;

const MERMAID_FENCE_LANGUAGE_ALIASES: ReadonlySet<string> = new Set(
  MERMAID_FENCE_LANGUAGE_ALIAS_LIST
);

const MERMAID_FENCE_PATTERN = /^```([\w+-]*)$/;

export function normalizeMermaidFenceLanguage(language: string | null | undefined) {
  return language?.trim().toLowerCase().replace(/[\s_-]+/g, '') ?? '';
}

export function isMermaidFenceLanguage(language: string | null | undefined) {
  return MERMAID_FENCE_LANGUAGE_ALIASES.has(normalizeMermaidFenceLanguage(language));
}

export function parseMermaidFenceLanguage(text: string) {
  const match = MERMAID_FENCE_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }

  const language = match[1] ?? '';
  return isMermaidFenceLanguage(language) ? language : null;
}
