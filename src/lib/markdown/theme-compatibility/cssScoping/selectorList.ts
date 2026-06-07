export function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    const previous = selectorList[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorList.slice(start).trim());
  return selectors.filter(Boolean);
}

export function findTopLevelBoundary(selector: string, start: number): number {
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = start; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (parenDepth === 0 && bracketDepth === 0 && (/[\s>+~]/.test(char))) {
      return index;
    }
  }

  return -1;
}

export function findMatchingParen(selector: string, openParenIndex: number): number {
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = openParenIndex; index < selector.length; index += 1) {
    const char = selector[index];
    const previous = selector[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth > 0) continue;
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}
