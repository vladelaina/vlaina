const FONT_FALLBACK = `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Tahoma, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`;

export const FontFamily = {
  Sans: `'Inter', 'Source Sans 3', 'Poppins', ${FONT_FALLBACK}`,
  
  Serif: `'Source Serif 4', 'Noto Serif', 'Lora', 'Cambria', Georgia, serif, ${FONT_FALLBACK}`,
  
  Mono: `'JetBrains Mono', 'Inter', 'Source Sans 3', 'Poppins', ${FONT_FALLBACK}`,
  
  Number: `'Roboto Mono', 'JetBrains Mono', ${FONT_FALLBACK}`,
} as const;

export const CanvasFontFamily = {
  Inter: `'Inter', ${FONT_FALLBACK}`,
  
  Kalam: `'Kalam', cursive, ${FONT_FALLBACK}`,
  
  Poppins: `'Poppins', 'Inter', ${FONT_FALLBACK}`,
  
  Lora: `'Lora', 'Source Serif 4', Georgia, serif, ${FONT_FALLBACK}`,
  
  BebasNeue: `'Bebas Neue', sans-serif`,
  
  OrelegaOne: `'Orelega One', sans-serif`,
  
  Satoshi: `'Inter', ${FONT_FALLBACK}`,
} as const;

export const CanvasFontList = [
  { id: 'inter', name: 'Inter', family: CanvasFontFamily.Inter },
  { id: 'kalam', name: 'Kalam', family: CanvasFontFamily.Kalam },
  { id: 'poppins', name: 'Poppins', family: CanvasFontFamily.Poppins },
  { id: 'lora', name: 'Lora', family: CanvasFontFamily.Lora },
  { id: 'bebas-neue', name: 'Bebas Neue', family: CanvasFontFamily.BebasNeue },
  { id: 'orelega-one', name: 'Orelega One', family: CanvasFontFamily.OrelegaOne },
] as const;

export const FontSize = {
  Title: 36,
  H1: 28,
  H2: 26,
  H3: 24,
  H4: 22,
  H5: 20,
  H6: 18,
  Base: 15,
  Sm: 14,
  Xs: 12,
} as const;

export const FontWeight = {
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
} as const;

export const FontCSSVar = {
  Sans: 'var(--font-sans)',
  Serif: 'var(--font-serif)',
  Mono: 'var(--font-mono)',
  Number: 'var(--font-number)',
  CanvasDefault: 'var(--font-canvas-default)',
  CanvasHandwriting: 'var(--font-canvas-handwriting)',
  CanvasSerif: 'var(--font-canvas-serif)',
  CanvasDisplay: 'var(--font-canvas-display)',
  CanvasModern: 'var(--font-canvas-modern)',
} as const;

export type FontFamilyType = keyof typeof FontFamily;
export type CanvasFontFamilyType = keyof typeof CanvasFontFamily;
