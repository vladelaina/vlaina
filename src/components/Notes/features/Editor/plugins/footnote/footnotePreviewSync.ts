import { normalizeFootnoteLabel, normalizeFootnotePreview } from './footnoteLabels';
import {
  collectFootnoteElements,
  isFootnoteDefinitionElement,
  isFootnoteReferenceElement,
  MAX_SYNCED_FOOTNOTE_DEFS,
  MAX_SYNCED_FOOTNOTE_REFS,
} from './footnoteScan';

export const MAX_FOOTNOTE_PREVIEW_SOURCE_TEXT_CHARS = 4096;

export function readBoundedFootnotePreviewSource(element: HTMLElement): string {
  let text = '';
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (
    let node = walker.nextNode();
    node && text.length < MAX_FOOTNOTE_PREVIEW_SOURCE_TEXT_CHARS;
    node = walker.nextNode()
  ) {
    const value = node.textContent ?? '';
    const remaining = MAX_FOOTNOTE_PREVIEW_SOURCE_TEXT_CHARS - text.length;
    text += value.length > remaining ? value.slice(0, remaining) : value;
  }
  return text;
}

function getFootnoteDefinitionPreview(definition: HTMLElement): string {
  const content = definition.querySelector('.footnote-def-content');
  const text = normalizeFootnotePreview(readBoundedFootnotePreviewSource(content instanceof HTMLElement ? content : definition));
  const label = normalizeFootnoteLabel(definition.dataset.id || definition.dataset.label);
  const labelPrefix = label ? `[${label}]:` : '';
  return labelPrefix && text.startsWith(labelPrefix)
    ? normalizeFootnotePreview(text.slice(labelPrefix.length))
    : text;
}

function collectFootnoteDefinitionPreviews(editorDom: HTMLElement): Map<string, string> {
  const previews = new Map<string, string>();
  const definitions = collectFootnoteElements(editorDom, isFootnoteDefinitionElement, MAX_SYNCED_FOOTNOTE_DEFS);

  for (const definition of definitions) {
    const id = normalizeFootnoteLabel(definition.dataset.id || definition.dataset.label);
    if (!id || previews.has(id)) continue;
    previews.set(id, getFootnoteDefinitionPreview(definition));
  }

  return previews;
}

export function syncFootnoteReferencePreviews(editorDom: HTMLElement): void {
  const refs = collectFootnoteElements(editorDom, isFootnoteReferenceElement, MAX_SYNCED_FOOTNOTE_REFS);
  const definitionPreviews = collectFootnoteDefinitionPreviews(editorDom);

  for (const ref of refs) {
    const id = normalizeFootnoteLabel(ref.dataset.id || ref.dataset.label);
    if (!id) continue;

    const preview = definitionPreviews.get(id) ?? '';
    ref.dataset.footnoteValue = preview || `[${id}]`;
  }
}
