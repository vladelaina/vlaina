const KATEX_SHARED_MACROS = Object.freeze({
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
});

export function createKatexRenderOptions() {
  return {
    strict: false,
    trust: false,
    macros: { ...KATEX_SHARED_MACROS },
  } as const;
}
