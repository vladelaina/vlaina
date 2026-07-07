import {
  MAX_REQUEST_JSON_ARRAY_ITEMS,
  MAX_REQUEST_JSON_DEPTH,
} from './requestContextLimits';

function measureJsonStringLength(value: string, maxChars: number): number {
  if (maxChars <= 0) {
    return 1;
  }

  let length = 2;
  if (length > maxChars) {
    return maxChars + 1;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) {
      length += 2;
    } else if (code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
      length += 2;
    } else if (code < 0x20) {
      length += 6;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        length += 2;
        index += 1;
      } else {
        length += 6;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      length += 6;
    } else {
      length += 1;
    }

    if (length > maxChars) {
      return maxChars + 1;
    }
  }

  return length;
}

function hasJsonSerializationHook(value: object): boolean {
  let current: object | null = value;
  while (current !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(current, 'toJSON');
    if (descriptor) {
      if (descriptor.get || descriptor.set) {
        return true;
      }
      return typeof descriptor.value === 'function';
    }
    current = Object.getPrototypeOf(current);
  }
  return false;
}

function isArrayIndexKey(key: string): boolean {
  if (key === '') {
    return false;
  }
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < 2 ** 32 - 1 && String(index) === key;
}

function hasInheritedArrayIndexProperty(value: unknown[]): boolean {
  let current = Object.getPrototypeOf(value);
  while (current !== null) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (isArrayIndexKey(key)) {
        return true;
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return false;
}

function measureJsonLength(value: unknown, maxChars: number, depth = 0): number {
  if (maxChars <= 0) {
    return 1;
  }

  if (value === null) {
    return 4;
  }

  switch (typeof value) {
    case 'string':
      return measureJsonStringLength(value, maxChars);
    case 'number':
      return Number.isFinite(value) ? String(value).length : 4;
    case 'boolean':
      return value ? 4 : 5;
    case 'object':
      break;
    default:
      return maxChars + 1;
  }

  if (hasJsonSerializationHook(value)) {
    return maxChars + 1;
  }

  if (depth >= MAX_REQUEST_JSON_DEPTH) {
    return maxChars + 1;
  }

  if (Array.isArray(value)) {
    return measureJsonArrayLength(value, maxChars, depth);
  }

  return measureJsonObjectLength(value as Record<string, unknown>, maxChars, depth);
}

function measureJsonArrayLength(value: unknown[], maxChars: number, depth: number): number {
  if (value.length > MAX_REQUEST_JSON_ARRAY_ITEMS || hasInheritedArrayIndexProperty(value)) {
    return maxChars + 1;
  }

  let length = 1;
  for (let index = 0; index < value.length; index += 1) {
    if (index > 0) {
      length += 1;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.get || descriptor?.set) {
      return maxChars + 1;
    }

    const item = descriptor ? descriptor.value : null;
    length += item === undefined || typeof item === 'function' || typeof item === 'symbol'
      ? 4
      : measureJsonLength(item, maxChars - length, depth + 1);
    if (length > maxChars) {
      return maxChars + 1;
    }
  }
  return length + 1;
}

function measureJsonObjectLength(value: Record<string, unknown>, maxChars: number, depth: number): number {
  let length = 1;
  let hasEntry = false;
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
      continue;
    }
    if (descriptor.get || descriptor.set) {
      return maxChars + 1;
    }

    const field = descriptor.value;
    if (field === undefined || typeof field === 'function' || typeof field === 'symbol') {
      continue;
    }

    if (hasEntry) {
      length += 1;
    }
    hasEntry = true;
    length += measureJsonStringLength(key, maxChars - length) + 1;
    if (length > maxChars) {
      return maxChars + 1;
    }

    length += measureJsonLength(field, maxChars - length, depth + 1);
    if (length > maxChars) {
      return maxChars + 1;
    }
  }
  return length + 1;
}

export function measureRequestJsonLength(value: unknown, maxChars: number): number {
  if (maxChars <= 0) {
    return 1;
  }

  return measureJsonLength(value, maxChars);
}
