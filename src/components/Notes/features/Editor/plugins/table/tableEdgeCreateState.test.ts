import { describe, expect, it } from 'vitest'

import {
  createEdgeCreateAnchors,
  resolveEdgeCreateAction,
} from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/edge-create-state'

describe('table edge create state', () => {
  it('requires crossing the new edge anchor before expanding again', () => {
    const startAnchors = createEdgeCreateAnchors(320, 320, 18)

    expect(
      resolveEdgeCreateAction({
        currentCoord: 338,
        previousCoord: 320,
        anchors: startAnchors,
      })
    ).toBe('expand')

    const nextAnchors = createEdgeCreateAnchors(338, 360, 18)

    expect(
      resolveEdgeCreateAction({
        currentCoord: 370,
        previousCoord: 338,
        anchors: nextAnchors,
      })
    ).toBeNull()

    expect(
      resolveEdgeCreateAction({
        currentCoord: 378,
        previousCoord: 370,
        anchors: nextAnchors,
      })
    ).toBe('expand')
  })

  it('does not shrink immediately after an expand without crossing back past the inward anchor', () => {
    const anchors = createEdgeCreateAnchors(338, 360, 18)

    expect(
      resolveEdgeCreateAction({
        currentCoord: 332,
        previousCoord: 338,
        anchors,
      })
    ).toBeNull()

    expect(
      resolveEdgeCreateAction({
        currentCoord: 320,
        previousCoord: 332,
        anchors,
      })
    ).toBe('shrink')
  })

  it('requires directionally matching movement for trigger decisions', () => {
    const anchors = createEdgeCreateAnchors(500, 500, 18)

    expect(
      resolveEdgeCreateAction({
        currentCoord: 519,
        previousCoord: 520,
        anchors,
      })
    ).toBeNull()

    expect(
      resolveEdgeCreateAction({
        currentCoord: 481,
        previousCoord: 480,
        anchors,
      })
    ).toBeNull()
  })
})
