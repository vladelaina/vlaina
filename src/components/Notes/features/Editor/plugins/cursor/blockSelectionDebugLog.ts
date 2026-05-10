import { logNotesDebug } from '../../../../../../stores/notes/lineBreakDebugLog';
import type { BlockRange, RectBounds } from './blockSelectionUtils';

export function formatDebugBlockRanges(blocks: readonly BlockRange[]): string {
  return blocks.length > 0
    ? blocks.map((range) => `[${range.from},${range.to}]`).join(' ')
    : '(none)';
}

export function formatDebugRect(rect: RectBounds): string {
  return `l=${Math.round(rect.left)} t=${Math.round(rect.top)} r=${Math.round(rect.right)} b=${Math.round(rect.bottom)}`;
}

export function describeDebugTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return String(target);

  const parts: string[] = [target.tagName.toLowerCase()];
  if (target.id) parts.push(`#${target.id}`);
  if (target.classList.length > 0) {
    parts.push(`.${Array.from(target.classList).slice(0, 4).join('.')}`);
  }
  const dataType = target.getAttribute('data-type') ?? target.getAttribute('data-node-type');
  if (dataType) parts.push(`[data-type=${dataType}]`);
  return parts.join('');
}

export function logBlockSelectionDebug(scope: string, payload?: unknown): void {
  logNotesDebug('NotesBlockSelect', scope, payload);
}
