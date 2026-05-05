import { normalizeMermaidFenceLanguage } from './mermaidLanguage';

const MERMAID_DIAGRAM_DIRECTIVE_PATTERN = new RegExp(
  [
    '^\\s*',
    '(?:---\\n[\\s\\S]*?\\n---\\s*)?',
    '(?:architecture(?:-beta)?|block(?:-beta)?|c4(?:context|container|component|dynamic|deployment)?|classDiagram(?:-v2)?|erDiagram|flowchart(?:-elk)?|gantt|gitGraph|graph|journey|kanban|mindmap|packet(?:-beta)?|pie|quadrantChart|radar(?:-beta)?|requirementDiagram|sankey(?:-beta)?|sequenceDiagram|stateDiagram(?:-v2)?|timeline|treemap(?:-beta)?|xychart(?:-beta)?)\\b',
  ].join(''),
  'i'
);

export function normalizeMermaidFenceCode(language: string | null | undefined, code: string) {
  const normalizedLanguage = normalizeMermaidFenceLanguage(language);

  if (
    (normalizedLanguage === 'sequence' || normalizedLanguage === 'sequencediagram')
    && code.trim()
    && !MERMAID_DIAGRAM_DIRECTIVE_PATTERN.test(code)
  ) {
    return `sequenceDiagram\n${code}`;
  }

  return code;
}
