import { getFirstMermaidDirective } from './mermaidDirective';

export type MermaidDiagramType = 'gantt';

export function getMermaidDiagramType(code: string): MermaidDiagramType | null {
  return getFirstMermaidDirective(code) === 'gantt' ? 'gantt' : null;
}
