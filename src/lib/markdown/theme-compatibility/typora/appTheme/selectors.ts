export function isTyporaDocumentBackgroundRule(selector: string): boolean {
  const normalized = selector.trim().replace(/\s+/g, ' ');
  if (!normalized) return false;

  return /^(?:body\.typora-export|\.typora-export(?:\s+|>)#write|content\s*>\s*#write)(?=$|[.#:[\s>+~])/i.test(normalized)
    || /^(?:\.typora-export\s+)?#write(?::not\([^)]*\))?(?:::before|::after|:before|:after)$/i.test(normalized)
    || /^\.v-welcome-page(?=$|[.#:[\s>+~])/i.test(normalized);
}

export function isTyporaDocumentBackgroundImageProperty(property: string): boolean {
  return /^--d-bi(?:-(?:lg|dk))?$/i.test(property);
}
