import type { NoteCoverMetadata } from './types';
import { quoteInlineFieldValue } from './frontmatterParsing';

const MAX_MANAGED_NUMBER_CHARS = 64;
const MANAGED_DECIMAL_NUMBER_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

interface LeadingInlineValue {
  value: string;
  fields: Map<string, string>;
}

function parseInlineFields(value: string | number | null | undefined): Map<string, string> {
  const fields = new Map<string, string>();
  if (typeof value !== 'string') {
    return fields;
  }

  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,;]/.test(value[index] ?? '')) {
      index += 1;
    }
    const nameStart = index;
    while (index < value.length && /[A-Za-z0-9_-]/.test(value[index] ?? '')) {
      index += 1;
    }
    if (index === nameStart || value[index] !== '=') {
      while (index < value.length && !/[\s,;]/.test(value[index] ?? '')) {
        index += 1;
      }
      continue;
    }

    const name = value.slice(nameStart, index).toLowerCase();
    index += 1;
    let parsedValue = '';
    const quote = value[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      while (index < value.length) {
        const character = value[index];
        if (character === quote) {
          index += 1;
          break;
        }
        if (quote === '"' && character === '\\' && index + 1 < value.length) {
          parsedValue += value[index + 1];
          index += 2;
          continue;
        }
        parsedValue += character;
        index += 1;
      }
    } else {
      const valueStart = index;
      while (index < value.length && !/[\s,;]/.test(value[index] ?? '')) {
        index += 1;
      }
      parsedValue = value.slice(valueStart, index);
    }

    fields.set(name, parsedValue);
  }

  return fields;
}

function parseManagedDecimalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_MANAGED_NUMBER_CHARS
    || !MANAGED_DECIMAL_NUMBER_PATTERN.test(trimmed)
  ) {
    return undefined;
  }

  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function getInlineNumber(fields: Map<string, string>, key: string): number | undefined {
  const value = fields.get(key);
  if (value === undefined) {
    return undefined;
  }
  return parseManagedDecimalNumber(value);
}

export function parseLeadingInlineValue(value: string | number | null | undefined): LeadingInlineValue | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  let index = 0;
  let parsedValue = '';
  const quote = trimmed[index];
  if (quote === '"' || quote === "'") {
    index += 1;
    let closed = false;
    while (index < trimmed.length) {
      const character = trimmed[index];
      if (character === quote) {
        if (quote === "'" && trimmed[index + 1] === "'") {
          parsedValue += "'";
          index += 2;
          continue;
        }
        index += 1;
        closed = true;
        break;
      }
      if (quote === '"' && character === '\\' && index + 1 < trimmed.length) {
        parsedValue += trimmed[index + 1];
        index += 2;
        continue;
      }
      parsedValue += character;
      index += 1;
    }
    if (!closed) {
      return undefined;
    }
  } else {
    const valueStart = index;
    while (index < trimmed.length && !/[\s,;]/.test(trimmed[index] ?? '')) {
      index += 1;
    }
    parsedValue = trimmed.slice(valueStart, index);
  }

  if (!parsedValue.trim()) {
    return undefined;
  }

  return {
    value: parsedValue,
    fields: parseInlineFields(trimmed.slice(index)),
  };
}

export function formatCoverLayout(cover: NoteCoverMetadata): string | null {
  const parts = [quoteInlineFieldValue(cover.assetPath)];

  if (cover.positionX !== undefined) parts.push(`x=${cover.positionX}`);
  if (cover.positionY !== undefined) parts.push(`y=${cover.positionY}`);
  if (cover.height !== undefined) parts.push(`height=${cover.height}`);
  if (cover.scale !== undefined) parts.push(`scale=${cover.scale}`);

  return parts.join(' ');
}

export function formatIconValue(icon: string, iconSize: number | undefined): string {
  const parts = [quoteInlineFieldValue(icon)];
  if (iconSize !== undefined) {
    parts.push(`size=${iconSize}`);
  }
  return parts.join(' ');
}
