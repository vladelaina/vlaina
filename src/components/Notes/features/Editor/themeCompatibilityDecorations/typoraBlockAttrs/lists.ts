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

export function getListAttrs(
  node: any,
  taskListCache?: WeakMap<object, boolean>
): DecorationAttrs | null {
  const classes: string[] = [];

  if (node.type?.name === 'bullet_list') {
    classes.push('has-list-bullet');
    if (listContainsTaskItems(node, taskListCache)) {
      classes.push('contains-task-list');
    }
    return { class: classes.join(' ') };
  }

  if (node.type?.name === 'ordered_list' && listContainsTaskItems(node, taskListCache)) {
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

export function listContainsTaskItems(node: any, cache?: WeakMap<object, boolean>): boolean {
  if (!node || typeof node !== 'object') return false;

  const cached = cache?.get(node);
  if (cached !== undefined) return cached;

  let containsTask = node.type?.name === 'list_item' && typeof node.attrs?.checked === 'boolean';
  if (!containsTask && typeof node.forEach === 'function') {
    node.forEach((child: any) => {
      if (containsTask) return;
      containsTask = listContainsTaskItems(child, cache);
    });
  }

  cache?.set(node, containsTask);
  return containsTask;
}
