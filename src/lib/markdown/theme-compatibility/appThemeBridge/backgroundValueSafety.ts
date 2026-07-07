import type postcss from 'postcss';

const NON_COLOR_BACKGROUND_KEYWORDS = new Set([
  'border-box',
  'bottom',
  'center',
  'contain',
  'content-box',
  'cover',
  'fixed',
  'left',
  'local',
  'no-repeat',
  'padding-box',
  'repeat',
  'repeat-x',
  'repeat-y',
  'right',
  'scroll',
  'top',
]);

export function isSafeAppThemeCustomPropertyValue(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  if (normalized.includes('javascript:') || normalized.includes('vbscript:')) {
    return false;
  }

  return !/url\(/i.test(value);
}

export function isSafeAppThemeBackgroundLayerValue(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return !normalized.includes('javascript:') && !normalized.includes('vbscript:');
}

export function isSafeAppThemeBackgroundValue(
  declaration: postcss.Declaration
): boolean {
  if (!isSafeAppThemeCustomPropertyValue(declaration.value)) {
    return false;
  }

  const property = declaration.prop.toLowerCase();
  if (property === 'background-color') {
    return isColorLikeCssValue(declaration.value);
  }

  if (property !== 'background') {
    return false;
  }

  const tokens = splitCssValueTokens(declaration.value);
  return tokens.length === 1 && isColorLikeCssValue(tokens[0]);
}

export function isSafeAppThemeBackgroundLayer(
  declaration: postcss.Declaration
): boolean {
  const property = declaration.prop.toLowerCase();
  if (property !== 'background' && property !== 'background-color' && property !== 'background-image') {
    return false;
  }
  if (!isSafeAppThemeBackgroundLayerValue(declaration.value)) {
    return false;
  }

  const normalized = declaration.value.trim();
  return Boolean(normalized) && !/^(?:none|transparent|initial|inherit|unset|revert|revert-layer)$/i.test(normalized);
}

export function isShellOnlyBackgroundValue(
  declaration: postcss.Declaration
): boolean {
  return isSafeAppThemeBackgroundValue(declaration);
}

function isColorLikeCssValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (/^(?:none|transparent|initial|inherit|unset|revert|revert-layer)$/i.test(normalized)) {
    return false;
  }
  if (normalized.startsWith('#')) return true;
  if (/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(/i.test(normalized)) {
    return true;
  }
  return /^[a-z]+$/i.test(normalized) && !NON_COLOR_BACKGROUND_KEYWORDS.has(normalized);
}

function splitCssValueTokens(value: string): string[] {
  const tokens: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (parenDepth === 0 && /\s/.test(char)) {
      const token = value.slice(start, index).trim();
      if (token) tokens.push(token);
      start = index + 1;
    }
  }

  const token = value.slice(start).trim();
  if (token) tokens.push(token);
  return tokens;
}
