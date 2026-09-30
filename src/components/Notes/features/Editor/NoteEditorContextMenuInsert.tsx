import { Fragment } from 'react';
import type { MessageKey } from '@/lib/i18n';
import type { ContextMenuInsertAction } from './noteEditorContextMenuActions';
import { MenuDivider, MenuItem } from './noteEditorContextMenuPrimitives';

interface InsertItem {
  action: ContextMenuInsertAction;
  label: MessageKey;
  shortcut?: string;
}

const insertItemGroups: InsertItem[][] = [
  [
    { action: 'image', label: 'editor.slash.image', shortcut: 'Ctrl+Shift+I' },
    { action: 'table', label: 'editor.slash.table', shortcut: 'Ctrl+T' },
    { action: 'code', label: 'editor.blockType.codeBlock', shortcut: 'Ctrl+Shift+K' },
    { action: 'divider', label: 'editor.slash.divider' },
    { action: 'callout', label: 'editor.slash.callout' },
    { action: 'emoji', label: 'icon.emoji' },
  ],
  [
    { action: 'formula', label: 'editor.slash.equation', shortcut: 'Ctrl+Shift+M' },
    { action: 'inline-math', label: 'editor.slash.inlineMath' },
    { action: 'footnote', label: 'editor.slash.footnote' },
    { action: 'footnote-definition', label: 'editor.slash.footnoteDefinition' },
    { action: 'link-reference', label: 'editor.contextMenu.linkReference' },
  ],
  [
    { action: 'toc', label: 'editor.slash.tableOfContents' },
    { action: 'mermaid', label: 'editor.slash.mermaidDiagram' },
    { action: 'html-block', label: 'editor.slash.htmlBlock' },
    { action: 'video', label: 'editor.slash.video' },
    { action: 'abbreviation', label: 'editor.slash.abbreviation' },
    { action: 'frontmatter', label: 'editor.contextMenu.yamlFrontMatter' },
  ],
];

export function NoteEditorContextMenuInsert({
  insert,
  t,
}: {
  insert: (action: ContextMenuInsertAction) => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <>
      {insertItemGroups.map((group, groupIndex) => (
        <Fragment key={group[0].action}>
          {groupIndex > 0 ? <MenuDivider /> : null}
          {group.map((item) => (
            <MenuItem
              key={item.action}
              label={t(item.label)}
              shortcut={item.shortcut}
              onSelect={() => insert(item.action)}
            />
          ))}
        </Fragment>
      ))}
      <MenuDivider />
      <MenuItem label={`${t('editor.preview.insertParagraph')} (${t('editor.preview.above')})`} onSelect={() => insert('paragraph-above')} />
      <MenuItem label={`${t('editor.preview.insertParagraph')} (${t('editor.preview.below')})`} onSelect={() => insert('paragraph-below')} />
    </>
  );
}
