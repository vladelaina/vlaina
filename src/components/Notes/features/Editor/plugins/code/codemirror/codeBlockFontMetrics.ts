type FontFaceSetLike = {
  ready?: Promise<unknown>;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
};

function getFontFaceSet(targetDocument: Document): FontFaceSetLike | null {
  const fonts = (targetDocument as Document & { fonts?: FontFaceSetLike }).fonts;
  return fonts ?? null;
}

export function bindCodeBlockFontMetricsSync(
  targetDocument: Document,
  onFontMetricsChange: () => void
) {
  const fonts = getFontFaceSet(targetDocument);
  if (!fonts) {
    return () => {};
  }

  let disposed = false;

  const handleFontMetricsChange: EventListener = () => {
    if (!disposed) {
      onFontMetricsChange();
    }
  };

  void fonts.ready
    ?.then(() => {
      handleFontMetricsChange(new Event('ready'));
    })
    .catch(() => {});

  fonts.addEventListener?.('loadingdone', handleFontMetricsChange);
  fonts.addEventListener?.('loadingerror', handleFontMetricsChange);

  return () => {
    disposed = true;
    fonts.removeEventListener?.('loadingdone', handleFontMetricsChange);
    fonts.removeEventListener?.('loadingerror', handleFontMetricsChange);
  };
}
