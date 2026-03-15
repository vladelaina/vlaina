export interface TableScrollSnapshot {
  scrollLeft: number
  scrollTop: number
  stickToRight: boolean
}

const tableScrollMemory = new Map<number, TableScrollSnapshot>()

export function rememberTableScroll(
  key: number | undefined,
  snapshot: TableScrollSnapshot
) {
  if (key == null) return
  tableScrollMemory.set(key, snapshot)
}

export function peekTableScroll(key: number | undefined) {
  if (key == null) return
  return tableScrollMemory.get(key)
}

export function forgetTableScroll(key: number | undefined) {
  if (key == null) return
  tableScrollMemory.delete(key)
}
