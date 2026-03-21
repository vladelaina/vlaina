import { describe, expect, it } from 'vitest'

import {
  resolveTableEdgeZoneLayout,
  resolveTableScrollRestorePosition,
  resolveTableWideLayoutMetrics,
} from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/table-block-layout'

describe('table block layout', () => {
  it('expands into the surrounding scroll root only when the table overflows horizontally', () => {
    expect(
      resolveTableWideLayoutMetrics({
        baseWidth: 420,
        leftReach: 36,
        rightReach: 52,
        naturalWidth: 560,
      })
    ).toEqual({
      maxWidth: 508,
      bleedLeft: 36,
      scrollStart: 36,
      scrollEnd: 52,
      tableMinWidth: '0px',
    })

    expect(
      resolveTableWideLayoutMetrics({
        baseWidth: 420,
        leftReach: 36,
        rightReach: 52,
        naturalWidth: 420,
      })
    ).toEqual({
      maxWidth: 420,
      bleedLeft: 0,
      scrollStart: 0,
      scrollEnd: 0,
      tableMinWidth: '100%',
    })
  })

  it('restores remembered scroll positions with right-stick and bounds clamping', () => {
    expect(
      resolveTableScrollRestorePosition({
        clientWidth: 320,
        clientHeight: 180,
        scrollWidth: 920,
        scrollHeight: 560,
        snapshot: {
          scrollLeft: 120,
          scrollTop: 900,
          stickToRight: true,
        },
      })
    ).toEqual({
      left: 600,
      top: 380,
    })

    expect(
      resolveTableScrollRestorePosition({
        clientWidth: 320,
        clientHeight: 180,
        scrollWidth: 920,
        scrollHeight: 560,
        snapshot: {
          scrollLeft: 999,
          scrollTop: 240,
          stickToRight: false,
        },
      })
    ).toEqual({
      left: 600,
      top: 240,
    })
  })

  it('positions edge-create zones from wrapper-relative table geometry', () => {
    expect(
      resolveTableEdgeZoneLayout({
        wrapperRect: {
          left: 60,
          top: 80,
        } as DOMRect,
        contentRect: {
          left: 104,
          top: 132,
          width: 360,
          height: 144,
        } as DOMRect,
        rowEdgeZoneSize: 18,
        colEdgeZoneSize: 18,
        cornerEdgeZoneSize: 30,
        cornerEdgeZoneInset: 10,
      })
    ).toEqual({
      bottom: {
        left: 44,
        top: 187,
        width: 360,
      },
      right: {
        top: 52,
        left: 395,
        height: 144,
      },
      corner: {
        top: 186,
        left: 394,
      },
    })
  })

  it('keeps bottom drag zones out of the horizontal scrollbar hit area', () => {
    expect(
      resolveTableEdgeZoneLayout({
        wrapperRect: {
          left: 60,
          top: 80,
        } as DOMRect,
        contentRect: {
          left: 104,
          top: 132,
          width: 360,
          height: 144,
        } as DOMRect,
        rowEdgeZoneSize: 18,
        colEdgeZoneSize: 18,
        cornerEdgeZoneSize: 30,
        cornerEdgeZoneInset: 10,
        hasHorizontalScrollbar: true,
      })
    ).toEqual({
      bottom: {
        left: 44,
        top: 178,
        width: 360,
      },
      right: {
        top: 52,
        left: 395,
        height: 144,
      },
      corner: {
        top: 166,
        left: 394,
      },
    })
  })
})
