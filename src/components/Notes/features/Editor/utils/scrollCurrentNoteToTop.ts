export function scrollCurrentNoteToTop() {
  const scrollRoot = document.querySelector<HTMLElement>('[data-note-scroll-root="true"]');
  if (!scrollRoot) {
    return false;
  }

  scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}
