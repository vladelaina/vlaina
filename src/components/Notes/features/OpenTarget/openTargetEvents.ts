const OPEN_MARKDOWN_TARGET_EVENT = 'vlaina-open-markdown-target';

export function dispatchOpenMarkdownTargetEvent(absolutePath: string): void {
  window.dispatchEvent(
    new CustomEvent<string>(OPEN_MARKDOWN_TARGET_EVENT, {
      detail: absolutePath,
    }),
  );
}

export function subscribeOpenMarkdownTargetEvent(
  listener: (absolutePath: string) => void,
): () => void {
  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    if (typeof customEvent.detail !== 'string' || !customEvent.detail) {
      return;
    }

    listener(customEvent.detail);
  };

  window.addEventListener(OPEN_MARKDOWN_TARGET_EVENT, handleEvent);
  return () => window.removeEventListener(OPEN_MARKDOWN_TARGET_EVENT, handleEvent);
}
