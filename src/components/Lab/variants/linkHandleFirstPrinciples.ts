export type LinkInteractionModel =
  | 'the-rail'
  | 'expanding-pill'
  | 'chrono-veil'
  | 'liquid-height'
  | 'bracket-pair'
  | 'ghost-input'
  | 'favicon-first'
  | 'magnetic-bubble'
  | 'negative-notch'
  | 'monet-blur'
  | 'typewriter-inline'
  | 'margin-mapping'
  | 'halo-wire'
  | 'zen-ring'
  | 'stitch-seam'
  | 'paper-stack'
  | 'glass-pane'
  | 'embossed-inset'
  | 'liquid-fusion'
  | 'facets'
  | 'sonic-line'
  | 'star-dust'
  | 'initial-logo'
  | 'history-flow'
  | 'security-tint'
  | 'micro-card'
  | 'auto-shorten'
  | 'link-strength'
  | 'multi-jump'
  | 'snapshot-trace'

export interface LinkEditorConcept {
  id: string
  name: string
  category: 'Zen' | 'Contextual' | 'Tactile' | 'Semantic' | 'Aesthetic'
  philosophy: string
  model: LinkInteractionModel
}

export const LINK_EDITOR_CONCEPTS: LinkEditorConcept[] = [
  { id: '1', name: 'The Rail', category: 'Zen', philosophy: 'A single 1px baseline. Pure text interaction.', model: 'the-rail' },
  { id: '2', name: 'Expanding Pill', category: 'Contextual', philosophy: 'A dot that grows as you type.', model: 'expanding-pill' },
  { id: '3', name: 'Chrono Veil', category: 'Aesthetic', philosophy: 'A soft clock-inspired overlay for focus.', model: 'chrono-veil' },
  { id: '4', name: 'Liquid Height', category: 'Contextual', philosophy: 'Drips down as URL length increases.', model: 'liquid-height' },
  { id: '5', name: 'Bracket Pair', category: 'Zen', philosophy: 'Framed by [ ] during editing.', model: 'bracket-pair' },
  { id: '6', name: 'Ghost Input', category: 'Zen', philosophy: 'Zero border, zero background, zero noise.', model: 'ghost-input' },
  { id: '7', name: 'Favicon First', category: 'Semantic', philosophy: 'Priority given to the link destination icon.', model: 'favicon-first' },
  { id: '8', name: 'Magnetic Bubble', category: 'Contextual', philosophy: 'Avoids nearby characters organically.', model: 'magnetic-bubble' },
  { id: '9', name: 'Negative Notch', category: 'Tactile', philosophy: 'A physical-like indent in the text line.', model: 'negative-notch' },
  { id: '10', name: 'Monet Blur', category: 'Aesthetic', philosophy: 'Impressionist colored shadows for depth.', model: 'monet-blur' },
  { id: '11', name: 'Typewriter Inline', category: 'Zen', philosophy: 'Editing occurs directly in the text line.', model: 'typewriter-inline' },
  { id: '12', name: 'Margin Mapping', category: 'Contextual', philosophy: 'Link handle appears in the editor margin.', model: 'margin-mapping' },
  { id: '13', name: 'Halo Wire', category: 'Aesthetic', philosophy: 'A thin flowing glowing border.', model: 'halo-wire' },
  { id: '14', name: 'Zen Ring', category: 'Aesthetic', philosophy: 'An open circle focus point.', model: 'zen-ring' },
  { id: '15', name: 'Stitch Seam', category: 'Tactile', philosophy: 'Mimics the seam of stitched paper.', model: 'stitch-seam' },
  { id: '16', name: 'Paper Stack', category: 'Tactile', philosophy: 'A small post-it like overlay with shadow.', model: 'paper-stack' },
  { id: '17', name: 'Glass Pane', category: 'Tactile', philosophy: 'Frosted glass effect with high blur.', model: 'glass-pane' },
  { id: '18', name: 'Embossed Inset', category: 'Tactile', philosophy: 'Looks sunken into the editor surface.', model: 'embossed-inset' },
  { id: '19', name: 'Liquid Fusion', category: 'Contextual', philosophy: 'Flows like mercury into its target shape.', model: 'liquid-fusion' },
  { id: '20', name: 'Facets', category: 'Tactile', philosophy: 'Geometric facets define the input zone.', model: 'facets' },
  { id: '21', name: 'Sonic Line', category: 'Aesthetic', philosophy: 'Waves move with your typing speed.', model: 'sonic-line' },
  { id: '22', name: 'Star Dust', category: 'Aesthetic', philosophy: 'Micro-grain background for deep texture.', model: 'star-dust' },
  { id: '23', name: 'Initial Logo', category: 'Semantic', philosophy: 'Background letter shows site initial.', model: 'initial-logo' },
  { id: '24', name: 'History Flow', category: 'Semantic', philosophy: 'Recently used links drift below.', model: 'history-flow' },
  { id: '25', name: 'Security Tint', category: 'Semantic', philosophy: 'Subtle hue change based on SSL status.', model: 'security-tint' },
  { id: '26', name: 'Micro Card', category: 'Semantic', philosophy: 'A tiny preview of the title and image.', model: 'micro-card' },
  { id: '27', name: 'Auto Shorten', category: 'Semantic', philosophy: 'Truncates URL intelligently on loss of focus.', model: 'auto-shorten' },
  { id: '28', name: 'Link Strength', category: 'Semantic', philosophy: 'Line weight indicates citation count.', model: 'link-strength' },
  { id: '29', name: 'Multi Jump', category: 'Contextual', philosophy: 'Handles multiple links in one segment.', model: 'multi-jump' },
  { id: '30', name: 'Snapshot Trace', category: 'Semantic', philosophy: 'A timestamp of the link last check.', model: 'snapshot-trace' },
]
