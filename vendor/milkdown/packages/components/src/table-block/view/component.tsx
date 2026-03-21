/* @jsxImportSource vue */
import type { Ctx } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/prose/view'

import {
  defineComponent,
  ref,
  onUpdated,
} from 'vue'

import type { CellIndex, Refs } from './types'

import { useColumnHeaderDrag } from './column-header-drag'
import { renderTableBlock } from './table-block-render'
import { useCornerCreateHandlers } from './corner-create'
import { useEdgeCreateHandlers } from './edge-create'
import { useOperation } from './operation'
import { usePointerHandlers } from './pointer'
import { useTableBlockLayout } from './table-block-layout'
import { useTableContentHost } from './table-content-host'

type TableBlockProps = {
  view: EditorView
  ctx: Ctx
  getPos: () => number | undefined
  onMount: (div: HTMLElement) => void
}

export const TableBlock = defineComponent<TableBlockProps>({
  props: {
    view: {
      type: Object,
      required: true,
    },
    ctx: {
      type: Object,
      required: true,
    },
    getPos: {
      type: Function,
      required: true,
    },
    onMount: {
      type: Function,
      required: true,
    },
  },
  setup({ view, ctx, getPos, onMount }) {
    const rowEdgeZoneSize = 18
    const colEdgeZoneSize = 18
    const cornerEdgeZoneSize = 30
    const cornerEdgeZoneInset = 10
    const rootRef = ref<HTMLDivElement>()
    const tableScrollRef = ref<HTMLDivElement>()
    const xLineHandleRef = ref<HTMLDivElement>()
    const yLineHandleRef = ref<HTMLDivElement>()
    const tableWrapperRef = ref<HTMLDivElement>()
    const bottomEdgeZoneRef = ref<HTMLDivElement>()
    const rightEdgeZoneRef = ref<HTMLDivElement>()
    const cornerEdgeZoneRef = ref<HTMLDivElement>()
    const lineHoverIndex = ref<CellIndex>([-1, -1])
    let queueLayoutSync = () => {}
    const {
      contentMountFunctionRef,
      contentWrapperRef,
      ensureContentHost,
    } = useTableContentHost({
      rootRef,
      onMount,
      onContentReady: () => {
        queueLayoutSync()
      },
    })

    const refs: Refs = {
      rootRef,
      tableWrapperRef,
      tableScrollRef,
      contentWrapperRef,
      yLineHandleRef,
      xLineHandleRef,
      lineHoverIndex,
    }

    const safeGetPos = () => {
      try {
        return getPos()
      } catch {
        return undefined
      }
    }

    const { pointerLeave, pointerMove } = usePointerHandlers(refs, view)
    const {
      onAppendRow,
      onAppendCol,
      onShrinkRow,
      onShrinkCol,
      onMoveCol,
      onInsertColLeft,
      onInsertColRight,
      onDeleteCol,
      onClearColContent,
      canShrinkRow,
      canShrinkCol,
    } = useOperation(refs, ctx, getPos)
    const {
      controls: headerDragControls,
      dragIndicator,
      dragSourceHighlight,
      menuId,
      menuState,
      syncControls: syncColumnHeaderControls,
      syncHoveredControl,
      clearHoveredControl,
      onRootPointerDown,
      onControlPointerDown,
      onControlClick,
      onControlKeyDown,
      onControlFocus,
      onControlBlur,
      onMenuPointerDown,
      onMenuKeyDown,
      onMenuAction,
      setMenuRef,
      setControlRef,
    } = useColumnHeaderDrag({
      ctx,
      tableWrapperRef,
      contentWrapperRef,
      tableScrollRef,
      moveCol: onMoveCol,
      insertColLeft: onInsertColLeft,
      insertColRight: onInsertColRight,
      clearColContent: onClearColContent,
      deleteCol: onDeleteCol,
    })
    const layout = useTableBlockLayout({
      rowEdgeZoneSize,
      colEdgeZoneSize,
      cornerEdgeZoneSize,
      cornerEdgeZoneInset,
      rootRef,
      tableWrapperRef,
      tableScrollRef,
      contentWrapperRef,
      bottomEdgeZoneRef,
      rightEdgeZoneRef,
      cornerEdgeZoneRef,
      ensureContentHost,
      getTableKey: safeGetPos,
      syncColumnHeaderControls,
    })
    const { syncEdgeCreateZones } = layout
    queueLayoutSync = layout.queueLayoutSync
    const {
      startRowEdgeCreate,
      startColEdgeCreate,
      startRowEdgeCreateMouse,
      startColEdgeCreateMouse,
      prepareRowEdgeCreate,
      prepareColEdgeCreate,
    } = useEdgeCreateHandlers(
      refs,
      () => view.editable,
      onAppendRow,
      onAppendCol,
      onShrinkRow,
      onShrinkCol,
      canShrinkRow,
      canShrinkCol,
      getPos
    )
    const { prepareCornerCreate, startCornerCreate, startCornerCreateMouse } =
      useCornerCreateHandlers(
        refs,
        () => view.editable,
        onAppendRow,
        onAppendCol,
        onShrinkRow,
        onShrinkCol,
        canShrinkRow,
        canShrinkCol,
        getPos
      )

    onUpdated(() => {
      if (ensureContentHost()) {
        queueLayoutSync()
      }
    })

    const handleZonePointerEnter =
      (axis: 'row' | 'col') => () => {
        syncEdgeCreateZones()
        if (axis === 'row') prepareRowEdgeCreate()
        else prepareColEdgeCreate()
      }

    const handleZonePointerDown =
      (axis: 'row' | 'col') => (e: PointerEvent) => {
        if (axis === 'row') startRowEdgeCreate(e)
        else startColEdgeCreate(e)
      }

    const handleZoneMouseDown =
      (axis: 'row' | 'col') => (e: MouseEvent) => {
        if (axis === 'row') startRowEdgeCreateMouse(e)
        else startColEdgeCreateMouse(e)
      }

    const handleCornerPointerEnter = () => {
      syncEdgeCreateZones()
      prepareCornerCreate()
    }

    const handleCornerPointerDown = (e: PointerEvent) => {
      startCornerCreate(e)
    }

    const handleCornerMouseDown = (e: MouseEvent) => {
      startCornerCreateMouse(e)
    }

    const handleTableScroll = () => {
      syncEdgeCreateZones()
    }

    return () =>
      renderTableBlock({
        rowEdgeZoneSize,
        colEdgeZoneSize,
        cornerEdgeZoneSize,
        rootRef,
        tableWrapperRef,
        tableScrollRef,
        xLineHandleRef,
        yLineHandleRef,
        bottomEdgeZoneRef,
        rightEdgeZoneRef,
        cornerEdgeZoneRef,
        contentMountFunctionRef,
        controls: headerDragControls.value,
        dragIndicator: dragIndicator.value,
        dragSourceHighlight: dragSourceHighlight.value,
        menuId,
        menuState: menuState.value,
        onRootPointerDown,
        onRootPointerMove: (event: PointerEvent) => {
          pointerMove(event)
          syncHoveredControl(event)
        },
        onRootPointerLeave: () => {
          pointerLeave()
          clearHoveredControl()
        },
        onControlBlur,
        onControlClick,
        onControlFocus,
        onControlKeyDown,
        onControlPointerDown,
        onMenuAction,
        onMenuKeyDown,
        onMenuPointerDown,
        setMenuRef,
        setControlRef,
        onRowZonePointerEnter: handleZonePointerEnter('row'),
        onRowZonePointerDown: handleZonePointerDown('row'),
        onRowZoneMouseDown: handleZoneMouseDown('row'),
        onColZonePointerEnter: handleZonePointerEnter('col'),
        onColZonePointerDown: handleZonePointerDown('col'),
        onColZoneMouseDown: handleZoneMouseDown('col'),
        onCornerPointerEnter: handleCornerPointerEnter,
        onCornerPointerDown: handleCornerPointerDown,
        onCornerMouseDown: handleCornerMouseDown,
        onTableScroll: handleTableScroll,
      })
  },
})
