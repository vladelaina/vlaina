import type { DecorationAttrs } from '../typoraTextSemantics';

export function getTaskListItemAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'list_item' || typeof node.attrs?.checked !== 'boolean') {
    return null;
  }

  const checked = node.attrs.checked;
  return {
    class: [
      'HyperMD-list-line',
      'cm-line',
      'md-task-list-item',
      'task-list-item',
      'HyperMD-task-line',
      checked ? 'is-checked' : '',
    ].filter(Boolean).join(' '),
    'data-task': checked ? 'x' : ' ',
    'aria-checked': String(checked),
  };
}

export function getListItemAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'list_item' || typeof node.attrs?.checked === 'boolean') {
    return null;
  }

  return {
    class: 'HyperMD-list-line cm-line',
  };
}

export function getListAttrs(node: any): DecorationAttrs | null {
  const classes: string[] = [];

  if (node.type?.name === 'bullet_list') {
    classes.push('has-list-bullet');
    if (listContainsTaskItems(node)) {
      classes.push('contains-task-list');
    }
    return { class: classes.join(' ') };
  }

  if (node.type?.name === 'ordered_list' && listContainsTaskItems(node)) {
    return { class: 'contains-task-list' };
  }

  return null;
}

export function getFirstBlockAttrs(
  node: any,
  index: number | undefined
): DecorationAttrs | null {
  if (index !== 0) return null;
  if (
    node.type?.name !== 'paragraph' &&
    node.type?.name !== 'bullet_list' &&
    node.type?.name !== 'ordered_list'
  ) {
    return null;
  }

  return { class: 'first-p' };
}

function listContainsTaskItems(node: any): boolean {
  let containsTask = false;
  node.descendants?.((child: any) => {
    if (child.type?.name === 'list_item' && typeof child.attrs?.checked === 'boolean') {
      containsTask = true;
      return false;
    }
    return true;
  });
  return containsTask;
}
