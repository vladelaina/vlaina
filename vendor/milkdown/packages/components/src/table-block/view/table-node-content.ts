export interface TableContentNodeLike {
  child: (index: number) => TableContentNodeLike
  childCount: number
  isLeaf: boolean
  isText: boolean
  text?: string | null
  type: {
    name: string
  }
}

export function isTableContentNodeEmpty(
  node: TableContentNodeLike | null | undefined
): boolean {
  if (!node) return true

  if (node.isText) {
    return (node.text ?? '').trim().length === 0
  }

  if (node.type.name === 'hard_break') {
    return true
  }

  if (node.isLeaf) {
    return false
  }

  for (let index = 0; index < node.childCount; index += 1) {
    if (!isTableContentNodeEmpty(node.child(index))) {
      return false
    }
  }

  return true
}
