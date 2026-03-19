export type InteractionPhysics =
  | 'grid-knot'
  | 'border-rift'
  | 'negative-notch'
  | 'rail-slider'
  | 'stitch-line'
  | 'level-step'
  | 'tension-string'
  | 'magnetic-reticle'
  | 'pendulum-swing'
  | 'liquid-fusion'
  | 'gravity-pendant'
  | 'surface-tension'
  | 'index-handle'
  | 'status-light'
  | 'text-anchor'
  | 'invisible-zone'
  | 'pixel-matrix'
  | 'glyph-marker'
  | 'floating-island'
  | 'perspective-inset'
  | 'halo-edge'
  | 'corner-fold'
  | 'layered-depth'
  | 'frosted-bar'
  | 'brush-trace'
  | 'chrono-tick'
  | 'infinity-twist'
  | 'balance-pivot'
  | 'zen-ring'
  | 'monet-shadow'

export interface DragHandleConcept {
  id: string
  name: string
  category: 'Grid' | 'Physics' | 'Minimalism' | 'Spatial' | 'Aesthetic'
  philosophy: string
  physics: InteractionPhysics
}

export const DRAG_HANDLE_CONCEPTS: DragHandleConcept[] = [
  { id: '1', name: 'Grid Knot', category: 'Grid', philosophy: 'Handle as a grid intersection point.', physics: 'grid-knot' },
  { id: '2', name: 'Border Rift', category: 'Grid', philosophy: 'The border line breaks on hover.', physics: 'border-rift' },
  { id: '3', name: 'Negative Notch', category: 'Grid', philosophy: 'A small cutout in the cell wall.', physics: 'negative-notch' },
  { id: '4', name: 'Rail Slider', category: 'Grid', philosophy: 'Columns sliding on a horizontal track.', physics: 'rail-slider' },
  { id: '5', name: 'Stitch Line', category: 'Grid', philosophy: 'Mimics the seam of stitched material.', physics: 'stitch-line' },
  { id: '6', name: 'Level Step', category: 'Grid', philosophy: 'A 3D elevation change on hover.', physics: 'level-step' },
  { id: '7', name: 'Tension String', category: 'Physics', philosophy: 'Stretches like a rubber band before pickup.', physics: 'tension-string' },
  { id: '8', name: 'Magnetic Reticle', category: 'Physics', philosophy: 'Targeting crosshair that snaps to points.', physics: 'magnetic-reticle' },
  { id: '9', name: 'Pendulum Swing', category: 'Physics', philosophy: 'Handle has physical inertia and sway.', physics: 'pendulum-swing' },
  { id: '10', name: 'Liquid Fusion', category: 'Physics', philosophy: 'The handle flows out like liquid metal.', physics: 'liquid-fusion' },
  { id: '11', name: 'Gravity Pendant', category: 'Physics', philosophy: 'A weighted object hanging from the edge.', physics: 'gravity-pendant' },
  { id: '12', name: 'Surface Tension', category: 'Physics', philosophy: 'Edge creates ripples when approached.', physics: 'surface-tension' },
  { id: '13', name: 'Index Handle', category: 'Minimalism', philosophy: 'The rank number is the handle.', physics: 'index-handle' },
  { id: '14', name: 'Status Light', category: 'Minimalism', philosophy: 'A pulsating status dot as the pivot.', physics: 'status-light' },
  { id: '15', name: 'Text Anchor', philosophy: 'The underline of the title is the drag path.', category: 'Minimalism', physics: 'text-anchor' },
  { id: '16', name: 'Invisible Zone', category: 'Minimalism', philosophy: 'Pure spatial awareness, no icon.', physics: 'invisible-zone' },
  { id: '17', name: 'Pixel Matrix', category: 'Minimalism', philosophy: 'A micro-grid of tiny interaction pixels.', physics: 'pixel-matrix' },
  { id: '18', name: 'Glyph Marker', category: 'Minimalism', philosophy: 'A single abstract character or glyph.', physics: 'glyph-marker' },
  { id: '19', name: 'Floating Island', category: 'Spatial', philosophy: 'The cell detaches and hovers on grab.', physics: 'floating-island' },
  { id: '20', name: 'Perspective Inset', category: 'Spatial', philosophy: 'Pushes into the screen when pressed.', physics: 'perspective-inset' },
  { id: '21', name: 'Halo Edge', category: 'Spatial', philosophy: 'A glowing aura along the interaction edge.', physics: 'halo-edge' },
  { id: '22', name: 'Corner Fold', category: 'Spatial', philosophy: 'A tiny folded paper corner for dragging.', physics: 'corner-fold' },
  { id: '23', name: 'Layered Depth', category: 'Spatial', philosophy: 'Multiple layers of shadows for tactile feel.', physics: 'layered-depth' },
  { id: '24', name: 'Frosted Bar', category: 'Spatial', philosophy: 'A blur-behind bar that floats on top.', physics: 'frosted-bar' },
  { id: '25', name: 'Brush Trace', category: 'Aesthetic', philosophy: 'An impressionist brush stroke as handle.', physics: 'brush-trace' },
  { id: '26', name: 'Chrono Tick', category: 'Aesthetic', philosophy: 'Fine marks derived from clock faces.', physics: 'chrono-tick' },
  { id: '27', name: 'Infinity Twist', category: 'Aesthetic', philosophy: 'A Möbius strip representing flow.', physics: 'infinity-twist' },
  { id: '28', name: 'Balance Pivot', category: 'Aesthetic', philosophy: 'A seesaw structure for order balance.', physics: 'balance-pivot' },
  { id: '29', name: 'Zen Ring', category: 'Aesthetic', philosophy: 'A minimalist open circle of focus.', physics: 'zen-ring' },
  { id: '30', name: 'Monet Shadow', category: 'Aesthetic', philosophy: 'Color-shifted shadows that evoke art.', physics: 'monet-shadow' },
]
