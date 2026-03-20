import type { Ref } from 'vue'

export type CellIndex = [row: number, col: number]

export interface Refs {
  rootRef?: Ref<HTMLDivElement | undefined>
  tableWrapperRef: Ref<HTMLDivElement | undefined>
  tableScrollRef?: Ref<HTMLDivElement | undefined>
  contentWrapperRef: Ref<HTMLElement | undefined>
  yLineHandleRef: Ref<HTMLDivElement | undefined>
  xLineHandleRef: Ref<HTMLDivElement | undefined>
  lineHoverIndex: Ref<CellIndex>
}
