export const KATEX_SHARED_RENDER_OPTIONS = {
  strict: false,
  trust: false,
  macros: {
    '\\R': '\\mathbb{R}',
    '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}',
    '\\Q': '\\mathbb{Q}',
    '\\C': '\\mathbb{C}',
  },
} as const;
