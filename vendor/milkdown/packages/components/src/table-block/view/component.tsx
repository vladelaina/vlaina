import type { Ctx } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/prose/view'

import {
  defineComponent,
  ref,
  type VNodeRef,
  onMounted,
  onBeforeUnmount,
} from 'vue'

import type { CellIndex, Refs } from './types'

import { useCornerCreateHandlers } from './corner-create'
import { useEdgeCreateHandlers } from './edge-create'
import { useOperation } from './operation'
import { usePointerHandlers } from './pointer'

type TableBlockProps = {
  view: EditorView
  ctx: Ctx
  getPos: () => number | undefined
  onMount: (div: Element) => void
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
    let resizeObserver: ResizeObserver | undefined
    const contentWrapperRef = ref<HTMLElement>()
    const contentWrapperFunctionRef: VNodeRef = (div) => {
      if (div == null) return
      if (div instanceof HTMLElement) {
        contentWrapperRef.value = div
        onMount(div)
        requestAnimationFrame(syncEdgeCreateZones)
      } else {
        contentWrapperRef.value = undefined
      }
    }
    const xLineHandleRef = ref<HTMLDivElement>()
    const yLineHandleRef = ref<HTMLDivElement>()
    const tableWrapperRef = ref<HTMLDivElement>()
    const bottomEdgeZoneRef = ref<HTMLDivElement>()
    const rightEdgeZoneRef = ref<HTMLDivElement>()
    const cornerEdgeZoneRef = ref<HTMLDivElement>()
    const lineHoverIndex = ref<CellIndex>([-1, -1])

    const refs: Refs = {
      tableWrapperRef,
      contentWrapperRef,
      yLineHandleRef,
      xLineHandleRef,
      lineHoverIndex,
    }

    const syncEdgeCreateZones = () => {
      const wrapper = tableWrapperRef.value
      const content = contentWrapperRef.value
      const bottomZone = bottomEdgeZoneRef.value
      const rightZone = rightEdgeZoneRef.value
      const cornerZone = cornerEdgeZoneRef.value
      if (!wrapper || !content) return

      const wrapperRect = wrapper.getBoundingClientRect()
      const contentRect = content.getBoundingClientRect()
      const left = contentRect.left - wrapperRect.left
      const top = contentRect.top - wrapperRect.top
      const width = contentRect.width
      const height = contentRect.height

      if (bottomZone) {
        Object.assign(bottomZone.style, {
          left: `${left}px`,
          top: `${top + height - 9}px`,
          width: `${width}px`,
        })
      }

      if (rightZone) {
        Object.assign(rightZone.style, {
          top: `${top}px`,
          left: `${left + width - 9}px`,
          height: `${height}px`,
        })
      }

      if (cornerZone) {
        Object.assign(cornerZone.style, {
          top: `${top + height - 11}px`,
          left: `${left + width - 11}px`,
        })
      }
    }

    const { pointerLeave, pointerMove } = usePointerHandlers(refs, view)
    const {
      onAppendRow,
      onAppendCol,
      onShrinkRow,
      onShrinkCol,
      canShrinkRow,
      canShrinkCol,
    } = useOperation(refs, ctx, getPos)
    const {
      startRowEdgeCreate,
      startColEdgeCreate,
      startRowEdgeCreateMouse,
      startColEdgeCreateMouse,
      prepareRowEdgeCreate,
      prepareColEdgeCreate,
    } = useEdgeCreateHandlers(
      refs,
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
        onAppendRow,
        onAppendCol,
        onShrinkRow,
        onShrinkCol,
        canShrinkRow,
        canShrinkCol,
        getPos
      )

    onMounted(() => {
      window.addEventListener('resize', syncEdgeCreateZones)
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          syncEdgeCreateZones()
        })

        if (tableWrapperRef.value) resizeObserver.observe(tableWrapperRef.value)
        if (contentWrapperRef.value) resizeObserver.observe(contentWrapperRef.value)
      }

      requestAnimationFrame(() => {
        syncEdgeCreateZones()
      })
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', syncEdgeCreateZones)
      resizeObserver?.disconnect()
    })

    const handleZonePointerEnter =
      (axis: 'row' | 'col') => (e: PointerEvent) => {
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

    const handleCornerPointerEnter = (e: PointerEvent) => {
      syncEdgeCreateZones()
      prepareCornerCreate()
    }

    const handleCornerPointerDown = (e: PointerEvent) => {
      startCornerCreate(e)
    }

    const handleCornerMouseDown = (e: MouseEvent) => {
      startCornerCreateMouse(e)
    }

    return () => {
      return (
        <div
          onPointermove={pointerMove}
          onPointerleave={pointerLeave}
        >
          <div class="table-wrapper" ref={tableWrapperRef}>
            <div
              contenteditable="false"
              data-role="bottom-edge-create-zone"
              class="edge-create-zone"
              data-axis="row"
              onPointerenter={handleZonePointerEnter('row')}
              onPointerdown={handleZonePointerDown('row')}
              onMousedown={handleZoneMouseDown('row')}
              ref={bottomEdgeZoneRef}
            />
            <div
              contenteditable="false"
              data-role="right-edge-create-zone"
              class="edge-create-zone"
              data-axis="col"
              onPointerenter={handleZonePointerEnter('col')}
              onPointerdown={handleZonePointerDown('col')}
              onMousedown={handleZoneMouseDown('col')}
              ref={rightEdgeZoneRef}
            />
            <div
              contenteditable="false"
              data-role="corner-edge-create-zone"
              class="edge-create-zone"
              data-axis="both"
              onPointerenter={handleCornerPointerEnter}
              onPointerdown={handleCornerPointerDown}
              onMousedown={handleCornerMouseDown}
              ref={cornerEdgeZoneRef}
            />
            <div
              data-show="false"
              contenteditable="false"
              data-display-type="tool"
              data-role="x-line-drag-handle"
              class="handle line-handle"
              ref={xLineHandleRef}
            />
            <div
              data-show="false"
              contenteditable="false"
              data-display-type="tool"
              data-role="y-line-drag-handle"
              class="handle line-handle"
              ref={yLineHandleRef}
            />
            <table ref={contentWrapperFunctionRef} class="children"></table>
          </div>
        </div>
      )
    }
  },
})
