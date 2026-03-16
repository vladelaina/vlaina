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
import {
  forgetTableScroll,
  peekTableScroll,
} from './table-scroll-memory'

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
    let observedScrollRoot: HTMLElement | undefined
    const rootRef = ref<HTMLDivElement>()
    const contentWrapperRef = ref<HTMLElement>()
    const tableScrollRef = ref<HTMLDivElement>()
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

    const syncWideLayout = () => {
      const root = rootRef.value
      const wrapper = tableWrapperRef.value
      const scroll = tableScrollRef.value
      const content = contentWrapperRef.value
      if (!root || !wrapper || !scroll || !content) return

      const closestScrollRoot = root.closest('[data-note-scroll-root="true"]')
      const scrollRoot =
        closestScrollRoot instanceof HTMLElement ? closestScrollRoot : undefined

      if (
        scrollRoot &&
        observedScrollRoot !== scrollRoot &&
        resizeObserver != null
      ) {
        if (observedScrollRoot) resizeObserver.unobserve(observedScrollRoot)
        resizeObserver.observe(scrollRoot)
        observedScrollRoot = scrollRoot
      }

      const rootRect = root.getBoundingClientRect()
      const scrollRootRect = scrollRoot?.getBoundingClientRect()
      const baseWidth = rootRect.width
      const leftReach = scrollRootRect
        ? Math.max(0, rootRect.left - scrollRootRect.left)
        : 0
      const rightReach = scrollRootRect
        ? Math.max(0, scrollRootRect.right - rootRect.right)
        : 0
      const availableWidth = baseWidth + leftReach + rightReach
      const naturalWidth = Math.ceil(content.scrollWidth)
      const isWideLayout = naturalWidth > baseWidth + 1
      const maxWidth = isWideLayout ? availableWidth : baseWidth
      const bleedLeft = isWideLayout ? leftReach : 0
      const scrollStart = isWideLayout ? leftReach : 0
      const scrollEnd = isWideLayout ? rightReach : 0
      const tableMinWidth = isWideLayout ? '0px' : '100%'

      wrapper.style.setProperty('--table-block-max-width', `${maxWidth}px`)
      wrapper.style.setProperty('--table-block-bleed-left', `${bleedLeft}px`)
      wrapper.style.setProperty('--table-block-scroll-start', `${scrollStart}px`)
      wrapper.style.setProperty('--table-block-scroll-end', `${scrollEnd}px`)
      wrapper.style.setProperty('--table-block-table-min-width', tableMinWidth)

      if (scroll.clientWidth === 0 || scroll.scrollWidth === 0) return

      let tableKey: number | undefined
      try {
        tableKey = getPos()
      } catch {
        tableKey = undefined
      }

      const pendingScroll = peekTableScroll(tableKey)
      if (!pendingScroll) return

      const maxScrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
      const nextScrollLeft = pendingScroll.stickToRight
        ? maxScrollLeft
        : Math.max(0, Math.min(pendingScroll.scrollLeft, maxScrollLeft))
      const maxScrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight)
      const nextScrollTop = Math.max(
        0,
        Math.min(pendingScroll.scrollTop, maxScrollTop)
      )

      if (
        Math.abs(scroll.scrollLeft - nextScrollLeft) > 1 ||
        Math.abs(scroll.scrollTop - nextScrollTop) > 1
      ) {
        scroll.scrollLeft = nextScrollLeft
        scroll.scrollTop = nextScrollTop
      }
      forgetTableScroll(tableKey)
    }

    const syncEdgeCreateZones = () => {
      syncWideLayout()

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
          top: `${top + height - 18}px`,
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
          top: `${top + height - 22}px`,
          left: `${left + width - 22}px`,
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
        if (tableScrollRef.value) resizeObserver.observe(tableScrollRef.value)
        if (contentWrapperRef.value) resizeObserver.observe(contentWrapperRef.value)
      }

      requestAnimationFrame(() => {
        syncEdgeCreateZones()
      })
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', syncEdgeCreateZones)
      if (observedScrollRoot) resizeObserver?.unobserve(observedScrollRoot)
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

    const handleTableScroll = () => {
      syncEdgeCreateZones()
    }

    return () => {
      return (
        <div
          ref={rootRef}
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
            <div
              class="table-scroll"
              ref={tableScrollRef}
              onScroll={handleTableScroll}
            >
              <div class="table-scroll-track">
                <div class="table-scroll-spacer" data-side="start" />
                <table ref={contentWrapperFunctionRef} class="children"></table>
                <div class="table-scroll-spacer" data-side="end" />
              </div>
            </div>
          </div>
        </div>
      )
    }
  },
})
