// Slash menu items definition
import type { SlashMenuItem } from './types';
import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx, commandsCtx } from '@milkdown/kit/core';
import { wrapInHeadingCommand, createCodeBlockCommand, insertHrCommand } from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';

// Helper to insert a node
function insertNode(ctx: Ctx, nodeType: string, attrs?: Record<string, unknown>) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { schema } = state;
  const type = schema.nodes[nodeType];
  
  if (!type) return;
  
  const node = type.create(attrs);
  const tr = state.tr.replaceSelectionWith(node);
  dispatch(tr.scrollIntoView());
}

// Helper to wrap in list
function wrapInList(ctx: Ctx, listType: 'bullet_list' | 'ordered_list') {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { schema } = state;
  
  const list = schema.nodes[listType];
  const listItem = schema.nodes.list_item;
  const paragraph = schema.nodes.paragraph;
  
  if (!list || !listItem || !paragraph) return;
  
  const item = listItem.create(null, paragraph.create());
  const node = list.create(null, item);
  
  const tr = state.tr.replaceSelectionWith(node);
  dispatch(tr.scrollIntoView());
}

// Helper to toggle task list
function insertTaskList(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { schema } = state;
  
  const list = schema.nodes.bullet_list;
  const listItem = schema.nodes.list_item;
  const paragraph = schema.nodes.paragraph;
  
  if (!list || !listItem || !paragraph) return;
  
  const item = listItem.create({ checked: false }, paragraph.create());
  const node = list.create(null, item);
  
  const tr = state.tr.replaceSelectionWith(node);
  dispatch(tr.scrollIntoView());
}

export const slashMenuItems: SlashMenuItem[] = [
  // Basic blocks
  {
    name: 'Text',
    icon: '📝',
    description: 'Plain text paragraph',
    group: 'Basic',
    searchAlias: ['paragraph', 'p'],
    action: (ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const { schema } = state;
      const paragraph = schema.nodes.paragraph;
      if (paragraph) {
        const node = paragraph.create();
        dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
      }
    }
  },
  {
    name: 'Heading 1',
    icon: 'H1',
    description: 'Large section heading',
    group: 'Basic',
    searchAlias: ['h1', 'title'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(wrapInHeadingCommand.key, 1);
    }
  },
  {
    name: 'Heading 2',
    icon: 'H2',
    description: 'Medium section heading',
    group: 'Basic',
    searchAlias: ['h2'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(wrapInHeadingCommand.key, 2);
    }
  },
  {
    name: 'Heading 3',
    icon: 'H3',
    description: 'Small section heading',
    group: 'Basic',
    searchAlias: ['h3'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(wrapInHeadingCommand.key, 3);
    }
  },
  {
    name: 'Heading 4',
    icon: 'H4',
    description: 'Subsection heading',
    group: 'Basic',
    searchAlias: ['h4'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(wrapInHeadingCommand.key, 4);
    }
  },
  {
    name: 'Heading 5',
    icon: 'H5',
    description: 'Minor heading',
    group: 'Basic',
    searchAlias: ['h5'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(wrapInHeadingCommand.key, 5);
    }
  },
  {
    name: 'Heading 6',
    icon: 'H6',
    description: 'Smallest heading',
    group: 'Basic',
    searchAlias: ['h6'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(wrapInHeadingCommand.key, 6);
    }
  },
  
  // Lists
  {
    name: 'Bullet List',
    icon: '•',
    description: 'Unordered list',
    group: 'Lists',
    searchAlias: ['ul', 'unordered'],
    action: (ctx) => wrapInList(ctx, 'bullet_list')
  },
  {
    name: 'Numbered List',
    icon: '1.',
    description: 'Ordered list',
    group: 'Lists',
    searchAlias: ['ol', 'ordered'],
    action: (ctx) => wrapInList(ctx, 'ordered_list')
  },
  {
    name: 'Task List',
    icon: '☑',
    description: 'Checklist with checkboxes',
    group: 'Lists',
    searchAlias: ['todo', 'checkbox', 'checklist'],
    action: insertTaskList
  },
  
  // Media
  {
    name: 'Code Block',
    icon: '</>',
    description: 'Code with syntax highlighting',
    group: 'Media',
    searchAlias: ['code', 'pre', 'snippet'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(createCodeBlockCommand.key);
    }
  },
  {
    name: 'Equation',
    icon: '∑',
    description: 'LaTeX math block',
    group: 'Media',
    searchAlias: ['math', 'latex', 'formula'],
    action: (ctx) => insertNode(ctx, 'math_block', { latex: '' })
  },
  {
    name: 'Image',
    icon: '🖼',
    description: 'Insert an image',
    group: 'Media',
    searchAlias: ['img', 'picture', 'photo'],
    action: (ctx) => insertNode(ctx, 'image', { src: '', alt: '' })
  },
  
  // Advanced
  {
    name: 'Table',
    icon: '▦',
    description: 'Insert a table',
    group: 'Advanced',
    searchAlias: ['grid'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(insertTableCommand.key);
    }
  },
  {
    name: 'Divider',
    icon: '—',
    description: 'Horizontal rule',
    group: 'Advanced',
    searchAlias: ['hr', 'line', 'separator'],
    action: (ctx) => {
      const commands = ctx.get(commandsCtx);
      commands.call(insertHrCommand.key);
    }
  },
  {
    name: 'Callout',
    icon: '💡',
    description: 'Highlighted note block',
    group: 'Advanced',
    searchAlias: ['note', 'tip', 'warning', 'info'],
    action: (ctx) => insertNode(ctx, 'callout', { 
      icon: { type: 'emoji', value: '💡' },
      backgroundColor: 'yellow'
    })
  },
  {
    name: 'Quote',
    icon: '"',
    description: 'Block quote',
    group: 'Advanced',
    searchAlias: ['blockquote', 'cite'],
    action: (ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const { schema } = state;
      const blockquote = schema.nodes.blockquote;
      const paragraph = schema.nodes.paragraph;
      if (blockquote && paragraph) {
        const node = blockquote.create(null, paragraph.create());
        dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
      }
    }
  },
  {
    name: 'Table of Contents',
    icon: '📑',
    description: 'Auto-generated TOC',
    group: 'Advanced',
    searchAlias: ['toc', 'contents', 'outline'],
    action: (ctx) => insertNode(ctx, 'toc', { maxLevel: 6 })
  },
  {
    name: 'Mermaid Diagram',
    icon: '📊',
    description: 'Flowchart, sequence diagram',
    group: 'Advanced',
    searchAlias: ['diagram', 'flowchart', 'chart', 'graph'],
    action: (ctx) => insertNode(ctx, 'mermaid', { code: 'graph TD\n    A[Start] --> B[End]' })
  },
  {
    name: 'Footnote',
    icon: '📝',
    description: 'Add a footnote reference',
    group: 'Advanced',
    searchAlias: ['note', 'reference', 'citation'],
    action: (ctx) => insertNode(ctx, 'footnote_ref', { id: '1' })
  },
  {
    name: 'Video',
    icon: '🎬',
    description: 'Embed YouTube, Bilibili video',
    group: 'Media',
    searchAlias: ['youtube', 'bilibili', 'embed', 'movie'],
    action: (ctx) => insertNode(ctx, 'video', { src: '' })
  }
];

// Filter items by query
export function filterSlashItems(query: string, items: SlashMenuItem[]): SlashMenuItem[] {
  if (!query) return items;
  
  const lowerQuery = query.toLowerCase();
  
  return items.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(lowerQuery);
    const aliasMatch = item.searchAlias?.some(alias => 
      alias.toLowerCase().includes(lowerQuery)
    );
    return nameMatch || aliasMatch;
  });
}

// Group items by category
export function groupSlashItems(items: SlashMenuItem[]): Map<string, SlashMenuItem[]> {
  const groups = new Map<string, SlashMenuItem[]>();
  
  items.forEach(item => {
    const group = groups.get(item.group) || [];
    group.push(item);
    groups.set(item.group, group);
  });
  
  return groups;
}
