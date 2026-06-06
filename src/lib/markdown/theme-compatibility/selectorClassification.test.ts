import { describe, expect, it } from 'vitest';
import {
  selectorTargetsImportedPageChrome,
  selectorTargetsKnownExternalExtension,
} from './selectorClassification';

describe('markdown theme selector classification', () => {
  it('classifies Typora and VLOOK app chrome separately from markdown content', () => {
    expect(selectorTargetsImportedPageChrome('#vlook-toc .v-toc-item:hover')).toBe(true);
    expect(selectorTargetsImportedPageChrome('.typora-export-sidebar .outline-item.active')).toBe(true);
    expect(selectorTargetsImportedPageChrome('#top-titlebar .ty-icon')).toBe(true);
    expect(selectorTargetsImportedPageChrome('.v-toolbar-btn.pressed')).toBe(true);
    expect(selectorTargetsImportedPageChrome('.mac-seamless-mode #write')).toBe(true);

    expect(selectorTargetsImportedPageChrome('#write .md-alert-note')).toBe(false);
    expect(selectorTargetsImportedPageChrome('#write blockquote:before')).toBe(false);
    expect(selectorTargetsImportedPageChrome('#write li .md-p > span')).toBe(false);
  });

  it('classifies Obsidian app and plugin chrome without treating rendered markdown as chrome', () => {
    expect(selectorTargetsImportedPageChrome('.workspace-leaf-content[data-type="markdown"] .view-header')).toBe(true);
    expect(selectorTargetsImportedPageChrome('.vertical-tab-nav-item.is-active')).toBe(true);
    expect(selectorTargetsImportedPageChrome('.kanban-plugin__board .kanban-plugin__item')).toBe(false);
    expect(selectorTargetsKnownExternalExtension('.kanban-plugin__board .kanban-plugin__item')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('.dataview.table-view-table')).toBe(true);

    expect(selectorTargetsImportedPageChrome('.markdown-preview-view h1')).toBe(false);
    expect(selectorTargetsImportedPageChrome('.callout[data-callout="note"]')).toBe(false);
  });

  it('keeps VLOOK extension shorthand classes out of the actionable compatibility queue', () => {
    expect(selectorTargetsKnownExternalExtension('.v-q.wn blockquote')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('.v-column .md-p')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('.v-tab-group .tab-content-target')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('.v-badge-name + .v-badge-value')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('.v-stepwise')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('.v-coating')).toBe(true);
    expect(selectorTargetsImportedPageChrome('.v-stepwise')).toBe(false);
    expect(selectorTargetsImportedPageChrome('.v-coating')).toBe(false);

    expect(selectorTargetsKnownExternalExtension('.md-alert-note')).toBe(false);
    expect(selectorTargetsKnownExternalExtension('.mathjax-block')).toBe(false);
  });

  it('handles external class attribute selectors used by theme setting plugins', () => {
    expect(selectorTargetsImportedPageChrome('[class*="v-fontinfo-"] .label')).toBe(true);
    expect(selectorTargetsImportedPageChrome('[class*="recent-files-"] .tree-item-inner')).toBe(true);
    expect(selectorTargetsKnownExternalExtension('[class*="mk-"] .mk-tree-node')).toBe(true);

    expect(selectorTargetsImportedPageChrome('img[src*="#card"]')).toBe(false);
    expect(selectorTargetsKnownExternalExtension('img[src*="#card"]')).toBe(false);
  });
});
