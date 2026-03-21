export type TableColumnDragActivationZone =
  | 'full-header'
  | 'top-band'
  | 'top-line'
  | 'center-band'
  | 'edge-band'

export type TableColumnDragRevealMode =
  | 'centered'
  | 'pointer-follow'
  | 'edge-snap'
  | 'glide'
  | 'line-condense'
  | 'magnet'

export type TableColumnDragDragStartMode =
  | 'immediate'
  | 'threshold-sm'
  | 'threshold-lg'
  | 'dwell'

export type TableColumnDragDropFeedbackMode =
  | 'line'
  | 'pill'
  | 'header-tint'
  | 'column-tint'
  | 'ghost'
  | 'push'

export type TableColumnDragSnapMode =
  | 'midpoint'
  | 'thirds'
  | 'edges'
  | 'magnet'

export type TableColumnDragHoverHoldMode = 'none' | 'brief' | 'sticky'

export type TableColumnDragCursorMode = 'ew-resize' | 'grab' | 'col-resize'

export type TableColumnDragHandleStyle =
  | 'notion-baseline'
  | 'minimal-dot'
  | 'triple-dot'
  | 'grip-vertical'
  | 'double-line'
  | 'pill-filled'
  | 'ghost-pill'
  | 'plus-thin'
  | 'chevron-pair'
  | 'dash-long'
  | 'diamond-small'
  | 'hollow-circle'
  | 'brackets'
  | 'wave-line'
  | 'corner-fold'
  | 'crosshair-tiny'
  | 'pixel-grid'
  | 'bar-trio'
  | 'slash-diagonal'
  | 'underline-glow'
  | 'overhang-tab'
  | 'knurled-texture'
  | 'target-ring'
  | 'arrow-indicator'
  | 'eye-minimal'
  | 'stitch-mark'
  | 'pulse-line'
  | 'infinity-loop'
  | 'square-outline'
  | 'floating-island'

export interface TableColumnDragVariant {
  id: string
  optionNumber: number
  featured: boolean
  name: string
  description: string
  handleStyle: TableColumnDragHandleStyle
  activationZone: TableColumnDragActivationZone
  revealMode: TableColumnDragRevealMode
  dragStartMode: TableColumnDragDragStartMode
  dropFeedbackMode: TableColumnDragDropFeedbackMode
  snapMode: TableColumnDragSnapMode
  hoverHoldMode: TableColumnDragHoverHoldMode
  cursorMode: TableColumnDragCursorMode
}

type VariantSeed = Omit<TableColumnDragVariant, 'id' | 'featured'> & {
  featured?: boolean
}

const VARIANT_SEEDS: VariantSeed[] = [
  {
    optionNumber: 1,
    featured: true,
    name: 'Notion Baseline',
    description: 'Top-band activation, centered oval handle, direct pickup, and a simple insertion line.',
    handleStyle: 'notion-baseline',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 2,
    featured: true,
    name: 'Minimal Point',
    description: 'A single 4px dot that appears on the top border. Extreme minimalism.',
    handleStyle: 'minimal-dot',
    activationZone: 'top-line',
    revealMode: 'centered',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'none',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 3,
    featured: true,
    name: 'Triple Dot Rail',
    description: 'Three horizontal dots tracking the pointer along the top band.',
    handleStyle: 'triple-dot',
    activationZone: 'top-band',
    revealMode: 'pointer-follow',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 4,
    name: 'Vertical Grip',
    description: 'A classic 6-dot vertical grip that appears anywhere on the header.',
    handleStyle: 'grip-vertical',
    activationZone: 'full-header',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'grab',
  },
  {
    optionNumber: 5,
    name: 'Double Groove',
    description: 'Two subtle vertical lines in the center of the drag lane.',
    handleStyle: 'double-line',
    activationZone: 'center-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 6,
    name: 'Filled Pill',
    description: 'A solid, high-contrast pill that snaps to header edges.',
    handleStyle: 'pill-filled',
    activationZone: 'edge-band',
    revealMode: 'edge-snap',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'edges',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 7,
    name: 'Ghost Outliner',
    description: 'A hollow pill frame that condenses from the top line.',
    handleStyle: 'ghost-pill',
    activationZone: 'top-line',
    revealMode: 'line-condense',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'edges',
    hoverHoldMode: 'none',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 8,
    name: 'Thin Plus',
    description: 'A hairline-thin plus sign that lingers after hover.',
    handleStyle: 'plus-thin',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 9,
    name: 'Chevron Duo',
    description: 'Two tiny chevrons pointing outward to suggest horizontal movement.',
    handleStyle: 'chevron-pair',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'sticky',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 10,
    name: 'Long Dash',
    description: 'A single, elegant horizontal dash on the top border.',
    handleStyle: 'dash-long',
    activationZone: 'top-line',
    revealMode: 'centered',
    dragStartMode: 'threshold-lg',
    dropFeedbackMode: 'line',
    snapMode: 'edges',
    hoverHoldMode: 'sticky',
    cursorMode: 'col-resize',
  },
  {
    optionNumber: 11,
    name: 'Micro Diamond',
    description: 'A 45-degree rotated square that feels like a precious jewelry pivot.',
    handleStyle: 'diamond-small',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'pill',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 12,
    name: 'Hollow Ring',
    description: 'A thin ring that tracks the pointer. Highly interactive feel.',
    handleStyle: 'hollow-circle',
    activationZone: 'top-band',
    revealMode: 'pointer-follow',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'pill',
    snapMode: 'midpoint',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 13,
    name: 'Minimal Brackets',
    description: 'Two subtle bracket marks that frame the drag insertion point.',
    handleStyle: 'brackets',
    activationZone: 'edge-band',
    revealMode: 'edge-snap',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'pill',
    snapMode: 'edges',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 14,
    name: 'Liquid Wave',
    description: 'A soft, wavy line that glides smoothly toward the cursor.',
    handleStyle: 'wave-line',
    activationZone: 'top-band',
    revealMode: 'glide',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'grab',
  },
  {
    optionNumber: 15,
    name: 'Folded Corner',
    description: 'A design that looks like a tiny folded paper corner on the top border.',
    handleStyle: 'corner-fold',
    activationZone: 'top-band',
    revealMode: 'line-condense',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 16,
    name: 'Crosshair Precision',
    description: 'A tiny crosshair for users who want pixel-perfect alignment.',
    handleStyle: 'crosshair-tiny',
    activationZone: 'top-band',
    revealMode: 'magnet',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 17,
    name: 'Pixel Grid',
    description: 'A 2x2 grid of micro-pixels that appears instantly on grab.',
    handleStyle: 'pixel-grid',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'immediate',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 18,
    name: 'Data Trio',
    description: 'Three vertical bars of varying height, suggesting data movement.',
    handleStyle: 'bar-trio',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 19,
    name: 'Diagonal Slash',
    description: 'A single bold slash that cuts through the top border line.',
    handleStyle: 'slash-diagonal',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-lg',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'none',
    cursorMode: 'grab',
  },
  {
    optionNumber: 20,
    name: 'Glow Underline',
    description: 'A subtle glowing line that appears under the top border after a hold.',
    handleStyle: 'underline-glow',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'dwell',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'sticky',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 21,
    name: 'Overhang Tab',
    description: 'A small tab that hangs over the top of the header like a file folder.',
    handleStyle: 'overhang-tab',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'header-tint',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 22,
    name: 'Knurled Strip',
    description: 'A high-friction textured strip for a tactile mechanical feel.',
    handleStyle: 'knurled-texture',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'column-tint',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 23,
    name: 'Target Ring',
    description: 'Concentric rings that pulse during the drag session.',
    handleStyle: 'target-ring',
    activationZone: 'top-band',
    revealMode: 'pointer-follow',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'ghost',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'grab',
  },
  {
    optionNumber: 24,
    name: 'Directional Arrow',
    description: 'A minimal up-down arrow that communicates the reorder capability.',
    handleStyle: 'arrow-indicator',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'push',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'col-resize',
  },
  {
    optionNumber: 25,
    name: 'Minimal Eye',
    description: 'An abstract eye-shaped handle that tracks movement in thirds.',
    handleStyle: 'eye-minimal',
    activationZone: 'top-band',
    revealMode: 'pointer-follow',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'thirds',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 26,
    name: 'Cross Stitch',
    description: 'Looks like a small cross-stitch on the table grid.',
    handleStyle: 'stitch-mark',
    activationZone: 'top-band',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'magnet',
    hoverHoldMode: 'brief',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 27,
    name: 'Pulse Wave',
    description: 'A heart-rate monitor style line for energetic interactions.',
    handleStyle: 'pulse-line',
    activationZone: 'edge-band',
    revealMode: 'edge-snap',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'edges',
    hoverHoldMode: 'none',
    cursorMode: 'ew-resize',
  },
  {
    optionNumber: 28,
    name: 'Infinity Loop',
    description: 'A symbol of continuous flow and infinite reordering.',
    handleStyle: 'infinity-loop',
    activationZone: 'full-header',
    revealMode: 'line-condense',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'midpoint',
    hoverHoldMode: 'brief',
    cursorMode: 'col-resize',
  },
  {
    optionNumber: 29,
    name: 'Floating Square',
    description: 'A hollow square that glides toward the pointer with a target tint.',
    handleStyle: 'square-outline',
    activationZone: 'center-band',
    revealMode: 'glide',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'header-tint',
    snapMode: 'thirds',
    hoverHoldMode: 'brief',
    cursorMode: 'grab',
  },
  {
    optionNumber: 30,
    name: 'Floating Island',
    description: 'A standalone rounded rectangle that feels detached from the grid.',
    handleStyle: 'floating-island',
    activationZone: 'top-line',
    revealMode: 'centered',
    dragStartMode: 'threshold-sm',
    dropFeedbackMode: 'line',
    snapMode: 'edges',
    hoverHoldMode: 'brief',
    cursorMode: 'col-resize',
  },
]


export const TABLE_COLUMN_DRAG_VARIANTS: TableColumnDragVariant[] =
  VARIANT_SEEDS.map((variant) => ({
    id: `table-column-drag-${variant.optionNumber}`,
    featured: variant.featured ?? false,
    ...variant,
  }))

export const TABLE_COLUMN_DRAG_PINNED_OPTION_NUMBERS = [1, 2, 3] as const
