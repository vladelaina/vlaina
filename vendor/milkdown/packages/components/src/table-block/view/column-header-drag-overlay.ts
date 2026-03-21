import { h, type VNode } from 'vue'

import type {
  ColumnHeaderControl,
  ColumnHighlight,
  ColumnMenuAction,
  ColumnMenuState,
  DragIndicator,
} from './column-header-drag-state'

type MenuEntry =
  | { type: 'item'; action: ColumnMenuAction; label: string; danger?: boolean }
  | { type: 'divider' }

type ColumnHeaderDragOverlayProps = {
  controls: ColumnHeaderControl[]
  dragIndicator: DragIndicator | null
  dragSourceHighlight: ColumnHighlight | null
  menuId: string
  menuState: ColumnMenuState | null
  onControlBlur: () => void
  onControlClick: (index: number, event: MouseEvent) => void
  onControlFocus: (index: number) => void
  onControlKeyDown: (index: number, event: KeyboardEvent) => void
  onControlPointerDown: (index: number, event: PointerEvent) => void
  onMenuAction: (action: ColumnMenuAction) => void
  onMenuKeyDown: (event: KeyboardEvent) => void
  onMenuPointerDown: (event: PointerEvent) => void
  setControlRef: (index: number, element: Element | null) => void
  setMenuRef: (element: Element | null) => void
}

const menuEntries: MenuEntry[] = [
  { type: 'item', action: 'insert-col-left', label: 'Insert column left' },
  { type: 'item', action: 'insert-col-right', label: 'Insert column right' },
  { type: 'divider' },
  { type: 'item', action: 'clear-col-content', label: 'Delete content' },
  { type: 'item', action: 'delete-col', label: 'Delete column', danger: true },
]

function renderMenuEntry(
  entry: MenuEntry,
  index: number,
  props: ColumnHeaderDragOverlayProps
) {
  if (entry.type === 'divider') {
    return h('div', {
      key: `divider-${index}`,
      class: 'column-header-drag-menu__divider',
    })
  }

  return h(
    'button',
    {
      key: entry.action,
      type: 'button',
      'data-role': 'col-header-drag-menu-item',
      role: 'menuitem',
      class: [
        'column-header-drag-menu__item',
        entry.danger ? 'column-header-drag-menu__item--danger' : null,
      ],
      onClick: (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        props.onMenuAction(entry.action)
      },
    },
    entry.label
  )
}

function renderControl(
  control: ColumnHeaderControl,
  props: ColumnHeaderDragOverlayProps
) {
  return h(
    'div',
    {
      key: control.index,
      ref: ((element: Element | null) =>
        props.setControlRef(control.index, element)) as never,
      contentEditable: false,
      tabIndex: 0,
      role: 'button',
      'data-role': 'col-header-drag-control',
      class: 'column-header-drag-control',
      'data-active': control.active ? 'true' : 'false',
      'aria-label': `Column ${control.index + 1} handle`,
      'aria-haspopup': 'menu',
      'aria-controls': props.menuId,
      'aria-expanded':
        props.menuState?.index === control.index ? 'true' : 'false',
      style: {
        left: `${control.handleLeft}px`,
        top: `${control.handleTop}px`,
        width: '36px',
        height: '18px',
      },
      onPointerdown: (event: PointerEvent) =>
        props.onControlPointerDown(control.index, event),
      onClick: (event: MouseEvent) => props.onControlClick(control.index, event),
      onKeydown: (event: KeyboardEvent) =>
        props.onControlKeyDown(control.index, event),
      onFocus: () => props.onControlFocus(control.index),
      onBlur: props.onControlBlur,
    },
    [
      h('span', {
        class: 'column-header-drag-control__grip',
      }),
    ]
  )
}

export function renderColumnHeaderDragOverlay(
  props: ColumnHeaderDragOverlayProps
): VNode {
  return h(
    'div',
    {
      contentEditable: false,
      class: 'column-header-drag-overlay',
    },
    [
      props.dragSourceHighlight != null
        ? h('div', {
            contentEditable: false,
            'data-role': 'col-header-drag-source-highlight',
            class: 'column-header-drag-source-highlight',
            style: {
              left: `${props.dragSourceHighlight.left}px`,
              top: `${props.dragSourceHighlight.top}px`,
              width: `${props.dragSourceHighlight.width}px`,
              height: `${props.dragSourceHighlight.height}px`,
            },
          })
        : null,
      props.menuState != null
        ? h(
            'div',
            {
              ref: ((element: Element | null) =>
                props.setMenuRef(element)) as never,
              id: props.menuId,
              contentEditable: false,
              'data-role': 'col-header-drag-menu',
              role: 'menu',
              'aria-orientation': 'vertical',
              class: 'column-header-drag-menu',
              style: {
                left: `${props.menuState.left}px`,
                top: `${props.menuState.top}px`,
                width: '196px',
              },
              onPointerdown: props.onMenuPointerDown,
              onKeydown: props.onMenuKeyDown,
            },
            menuEntries.map((entry, index) => renderMenuEntry(entry, index, props))
          )
        : null,
      ...props.controls
        .filter((control) => control.visible)
        .map((control) => renderControl(control, props)),
      props.dragIndicator != null
        ? h('div', {
            contentEditable: false,
            'data-role': 'col-header-drag-indicator',
            class: 'column-header-drag-indicator',
            style: {
              left: `${props.dragIndicator.left}px`,
              top: `${props.dragIndicator.top}px`,
              height: `${props.dragIndicator.height}px`,
            },
          })
        : null,
    ]
  )
}
