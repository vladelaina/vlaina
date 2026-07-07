function readFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.length <= 64) {
    const trimmed = value.trim();
    if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

export function normalizeCaptureRect(rect) {
  const rawX = readFiniteNumber(rect?.x);
  const rawY = readFiniteNumber(rect?.y);
  const rawWidth = readFiniteNumber(rect?.width);
  const rawHeight = readFiniteNumber(rect?.height);
  const x = rawX === null ? Number.NaN : Math.max(0, Math.floor(rawX));
  const y = rawY === null ? Number.NaN : Math.max(0, Math.floor(rawY));
  const width = rawWidth === null ? Number.NaN : Math.max(1, Math.ceil(rawWidth));
  const height = rawHeight === null ? Number.NaN : Math.max(1, Math.ceil(rawHeight));

  if (![x, y, width, height].every(Number.isFinite)) {
    throw new Error('A valid capture rectangle is required.');
  }

  return { x, y, width, height };
}
