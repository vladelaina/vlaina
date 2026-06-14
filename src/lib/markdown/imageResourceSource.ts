export function stripImagePresentationFragment(src: string): string {
  const trimmed = src.trim();
  if (!trimmed || /^data:/i.test(trimmed)) {
    return trimmed;
  }

  const hashIndex = trimmed.indexOf('#');
  return hashIndex > 0 ? trimmed.slice(0, hashIndex) : trimmed;
}
