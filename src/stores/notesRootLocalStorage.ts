export function loadFromStorage<T>(
  key: string,
  defaultValue: T,
  options: { maxLength?: number } = {},
): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved && options.maxLength && saved.length > options.maxLength) {
      return defaultValue;
    }
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}
