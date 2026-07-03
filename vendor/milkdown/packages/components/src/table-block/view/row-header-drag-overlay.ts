import { h, type VNode } from 'vue'
import { translate, type MessageKey } from '@/lib/i18n'

import type {
  RowDragIndicator,
  RowHeaderControl,
  RowHighlight,
  RowMenuAction,
  RowMenuState,
} from './row-header-drag-state'

type MenuEntry =
  | { type: 'item'; action: RowMenuAction; labelKey: MessageKey; danger?: boolean }
  | { type: 'divider' }

type RowHeaderDragOverlayProps = {
  controls: RowHeaderControl[]
  dragIndicator: RowDragIndicator | null
  dragSourceHighlight: RowHighlight | null
  menuId: string
  menuState: RowMenuState | null
  onControlBlur: () => void
  onControlClick: (index: number, event: MouseEvent) => void
  onControlFocus: (index: number) => void
  onControlKeyDown: (index: number, event: KeyboardEvent) => void
  onControlPointerDown: (index: number, event: PointerEvent) => void
  onMenuAction: (action: RowMenuAction) => void
  onMenuKeyDown: (event: KeyboardEvent) => void
  onMenuPointerDown: (event: PointerEvent) => void
  setControlRef: (index: number, element: Element | null) => void
  setMenuRef: (element: Element | null) => void
}

const menuEntries: MenuEntry[] = [
  { type: 'item', action: 'insert-row-above', labelKey: 'editor.table.insertRowAbove' },
  { type: 'item', action: 'insert-row-below', labelKey: 'editor.table.insertRowBelow' },
  { type: 'divider' },
  { type: 'item', action: 'clear-row-content', labelKey: 'editor.table.deleteColumnContent' },
  { type: 'item', action: 'delete-row', labelKey: 'editor.table.deleteRow', danger: true },
]

function renderMenuEntry(
  entry: MenuEntry,
  index: number,
  props: RowHeaderDragOverlayProps
) {
  if (entry.type === 'divider') {
    return h('div', {
      key: `divider-${index}`,
      class: 'row-header-drag-menu__divider',
    })
  }

  return h(
    'button',
    {
      key: entry.action,
      type: 'button',
      'data-role': 'row-header-drag-menu-item',
      role: 'menuitem',
      class: [
        'row-header-drag-menu__item',
        entry.danger ? 'row-header-drag-menu__item--danger' : null,
      ],
      onClick: (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        props.onMenuAction(entry.action)
      },
    },
    translate(entry.labelKey)
  )
}

function renderControl(
  control: RowHeaderControl,
  props: RowHeaderDragOverlayProps
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
      'data-role': 'row-header-drag-control',
      class: 'row-header-drag-control',
      'data-active': control.active ? 'true' : 'false',
      'aria-label': translate('editor.table.rowHandle', { number: control.index + 1 }),
      'aria-haspopup': 'menu',
      'aria-controls': props.menuId,
      'aria-expanded':
        props.menuState?.index === control.index ? 'true' : 'false',
      style: {
        left: `${control.handleLeft}px`,
        top: `${control.handleTop}px`,
        width: '18px',
        height: '36px',
      },
      onPointerdown: (event: PointerEvent) =>
        props.onControlPointerDown(control.index, event),
      onMousedown: (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
      },
      onClick: (event: MouseEvent) => props.onControlClick(control.index, event),
      onKeydown: (event: KeyboardEvent) =>
        props.onControlKeyDown(control.index, event),
      onFocus: () => props.onControlFocus(control.index),
      onBlur: props.onControlBlur,
    },
    [
      h('span', {
        class: 'row-header-drag-control__grip',
      }),
    ]
  )
}

export function renderRowHeaderDragOverlay(
  props: RowHeaderDragOverlayProps
): VNode {
  return h(
    'div',
    {
      contentEditable: false,
      class: 'row-header-drag-overlay',
    },
    [
      props.dragSourceHighlight != null
        ? h('div', {
            contentEditable: false,
            'data-role': 'row-header-drag-source-highlight',
            class: 'row-header-drag-source-highlight',
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
              'data-role': 'row-header-drag-menu',
              role: 'menu',
              'aria-orientation': 'vertical',
              class: ['row-header-drag-menu', 'vlaina-sidebar-menu-surface'],
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
            'data-role': 'row-header-drag-indicator',
            class: 'row-header-drag-indicator',
            style: {
              left: `${props.dragIndicator.left}px`,
              top: `${props.dragIndicator.top}px`,
              width: `${props.dragIndicator.width}px`,
            },
          })
        : null,
    ]
  )
}
