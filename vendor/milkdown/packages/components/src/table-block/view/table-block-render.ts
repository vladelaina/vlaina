import { h, type Ref, type VNodeRef } from 'vue'

import type {
  ColumnHeaderControl,
  ColumnHighlight,
  ColumnMenuAction,
  ColumnMenuState,
  DragIndicator,
} from './column-header-drag-state'
import { renderColumnHeaderDragOverlay } from './column-header-drag-overlay'

type RenderTableBlockOptions = {
  rowEdgeZoneSize: number
  colEdgeZoneSize: number
  cornerEdgeZoneSize: number
  rootRef: Ref<HTMLDivElement | undefined>
  tableWrapperRef: Ref<HTMLDivElement | undefined>
  tableScrollRef: Ref<HTMLDivElement | undefined>
  xLineHandleRef: Ref<HTMLDivElement | undefined>
  yLineHandleRef: Ref<HTMLDivElement | undefined>
  bottomEdgeZoneRef: Ref<HTMLDivElement | undefined>
  rightEdgeZoneRef: Ref<HTMLDivElement | undefined>
  cornerEdgeZoneRef: Ref<HTMLDivElement | undefined>
  contentMountFunctionRef: VNodeRef
  controls: ColumnHeaderControl[]
  dragIndicator: DragIndicator | null
  dragSourceHighlight: ColumnHighlight | null
  menuId: string
  menuState: ColumnMenuState | null
  onRootPointerDown: (event: PointerEvent) => void
  onRootPointerMove: (event: PointerEvent) => void
  onRootPointerLeave: () => void
  onControlBlur: () => void
  onControlClick: (index: number, event: MouseEvent) => void
  onControlFocus: (index: number) => void
  onControlKeyDown: (index: number, event: KeyboardEvent) => void
  onControlPointerDown: (index: number, event: PointerEvent) => void
  onMenuAction: (action: ColumnMenuAction) => void
  onMenuKeyDown: (event: KeyboardEvent) => void
  onMenuPointerDown: (event: PointerEvent) => void
  setMenuRef: (element: Element | null) => void
  setControlRef: (index: number, element: Element | null) => void
  onRowZonePointerEnter: () => void
  onRowZonePointerDown: (event: PointerEvent) => void
  onRowZoneMouseDown: (event: MouseEvent) => void
  onColZonePointerEnter: () => void
  onColZonePointerDown: (event: PointerEvent) => void
  onColZoneMouseDown: (event: MouseEvent) => void
  onCornerPointerEnter: () => void
  onCornerPointerDown: (event: PointerEvent) => void
  onCornerMouseDown: (event: MouseEvent) => void
  onTableScroll: () => void
}

export function renderTableBlock(options: RenderTableBlockOptions) {
  return h(
    'div',
    {
      ref: options.rootRef,
      onPointerdown: options.onRootPointerDown,
      onPointermove: options.onRootPointerMove,
      onPointerleave: options.onRootPointerLeave,
    },
    [
      h(
        'div',
        {
          class: 'table-wrapper',
          ref: options.tableWrapperRef,
        },
        [
          renderColumnHeaderDragOverlay({
            controls: options.controls,
            dragIndicator: options.dragIndicator,
            dragSourceHighlight: options.dragSourceHighlight,
            menuId: options.menuId,
            menuState: options.menuState,
            onControlBlur: options.onControlBlur,
            onControlClick: options.onControlClick,
            onControlFocus: options.onControlFocus,
            onControlKeyDown: options.onControlKeyDown,
            onControlPointerDown: options.onControlPointerDown,
            onMenuAction: options.onMenuAction,
            onMenuKeyDown: options.onMenuKeyDown,
            onMenuPointerDown: options.onMenuPointerDown,
            setControlRef: options.setControlRef,
            setMenuRef: options.setMenuRef,
          }),
          h('div', {
            contenteditable: 'false',
            'data-role': 'bottom-edge-create-zone',
            class: 'edge-create-zone',
            'data-axis': 'row',
            style: {
              height: `${options.rowEdgeZoneSize}px`,
            },
            onPointerenter: options.onRowZonePointerEnter,
            onPointerdown: options.onRowZonePointerDown,
            onMousedown: options.onRowZoneMouseDown,
            ref: options.bottomEdgeZoneRef,
          }),
          h('div', {
            contenteditable: 'false',
            'data-role': 'right-edge-create-zone',
            class: 'edge-create-zone',
            'data-axis': 'col',
            style: {
              width: `${options.colEdgeZoneSize}px`,
            },
            onPointerenter: options.onColZonePointerEnter,
            onPointerdown: options.onColZonePointerDown,
            onMousedown: options.onColZoneMouseDown,
            ref: options.rightEdgeZoneRef,
          }),
          h('div', {
            contenteditable: 'false',
            'data-role': 'corner-edge-create-zone',
            class: 'edge-create-zone',
            'data-axis': 'both',
            style: {
              width: `${options.cornerEdgeZoneSize}px`,
              height: `${options.cornerEdgeZoneSize}px`,
            },
            onPointerenter: options.onCornerPointerEnter,
            onPointerdown: options.onCornerPointerDown,
            onMousedown: options.onCornerMouseDown,
            ref: options.cornerEdgeZoneRef,
          }),
          h('div', {
            'data-show': 'false',
            contenteditable: 'false',
            'data-display-type': 'tool',
            'data-role': 'x-line-drag-handle',
            class: 'handle line-handle',
            ref: options.xLineHandleRef,
          }),
          h('div', {
            'data-show': 'false',
            contenteditable: 'false',
            'data-display-type': 'tool',
            'data-role': 'y-line-drag-handle',
            class: 'handle line-handle',
            ref: options.yLineHandleRef,
          }),
          h(
            'div',
            {
              class: 'table-scroll',
              ref: options.tableScrollRef,
              onScroll: options.onTableScroll,
            },
            [
              h('div', { class: 'table-scroll-track' }, [
                h('div', {
                  class: 'table-scroll-spacer',
                  'data-side': 'start',
                }),
                h('div', {
                  ref: options.contentMountFunctionRef,
                  class: 'table-content-host',
                }),
                h('div', {
                  class: 'table-scroll-spacer',
                  'data-side': 'end',
                }),
              ]),
            ]
          ),
        ]
      ),
    ]
  )
}
