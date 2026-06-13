import { decodeCssEscapesForUrl } from './theme-compatibility/cssUrls/cssEscapes';

const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
function normalizeSvgCssResourceText(value: string): string {
  return decodeCssEscapesForUrl(value).replace(CSS_COMMENT_PATTERN, ' ');
}

export function isLocalSvgReference(value: string): boolean {
  return normalizeSvgCssResourceText(value).trim().startsWith('#');
}

export function containsExternalSvgUrlReference(value: string): boolean {
  const normalizedValue = normalizeSvgCssResourceText(value);
  const urlReferencePattern = /url\s*\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlReferencePattern.exec(normalizedValue)) !== null) {
    if (!isLocalSvgReference(match[2] || '')) {
      return true;
    }
  }
  return false;
}

export function containsExternalSvgStyleElementReference(value: string): boolean {
  const normalizedValue = normalizeSvgCssResourceText(value);
  return /@import/i.test(normalizedValue) || containsExternalSvgUrlReference(normalizedValue);
}

function splitCssDeclarations(value: string): string[] {
  const declarations: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let escaped = false;
  let parenDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
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
    if (char === ')' && parenDepth > 0) {
      parenDepth -= 1;
      continue;
    }
    if (char === ';' && parenDepth === 0) {
      const declaration = value.slice(start, index).trim();
      if (declaration) {
        declarations.push(declaration);
      }
      start = index + 1;
    }
  }

  const tail = value.slice(start).trim();
  if (tail) {
    declarations.push(tail);
  }
  return declarations;
}

function findCssDeclarationColon(value: string): number {
  let quote: string | null = null;
  let escaped = false;
  let parenDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
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
    if (char === ')' && parenDepth > 0) {
      parenDepth -= 1;
      continue;
    }
    if (char === ':' && parenDepth === 0) {
      return index;
    }
  }

  return -1;
}

function isSafeCssDeclarationName(value: string): boolean {
  return /^(?:--[A-Za-z0-9_-]+|-?[A-Za-z][A-Za-z0-9-]*)$/.test(value.trim());
}

export function removeExternalSvgStyleDeclarations(value: string): string {
  const declarations: string[] = [];
  for (const declaration of splitCssDeclarations(value)) {
    const colonIndex = findCssDeclarationColon(declaration);
    if (colonIndex <= 0) {
      continue;
    }

    const propertyName = declaration.slice(0, colonIndex).trim();
    const propertyValue = declaration.slice(colonIndex + 1).trim();
    if (
      !isSafeCssDeclarationName(propertyName) ||
      !propertyValue ||
      containsExternalSvgUrlReference(propertyValue)
    ) {
      continue;
    }

    declarations.push(`${propertyName}: ${propertyValue}`);
  }

  return declarations.join('; ');
}
