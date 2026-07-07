export const MAX_OPENAI_TOOL_ARGUMENT_CHARS = 64 * 1024;

const MAX_OPENAI_TOOL_ARGUMENT_OBJECT_KEYS = 32;
const MAX_OPENAI_TOOL_ARGUMENT_ARRAY_ITEMS = 16;
const MAX_OPENAI_TOOL_ARGUMENT_DEPTH = 4;
const MAX_OPENAI_TOOL_ARGUMENT_VALUE_CHARS = 4096;

export function boundedToolString(value: unknown, maxChars: number): string {
  return typeof value === 'string' ? value.slice(0, maxChars) : '';
}

export function canParseOpenAIToolArguments(value: string): boolean {
  return value.length <= MAX_OPENAI_TOOL_ARGUMENT_CHARS;
}

export function limitOpenAIToolArguments(value: string): string {
  return value.length > MAX_OPENAI_TOOL_ARGUMENT_CHARS
    ? value.slice(0, MAX_OPENAI_TOOL_ARGUMENT_CHARS)
    : value;
}

function normalizeToolArgumentJsonValue(value: unknown, depth = 0): unknown {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case 'string':
      return value.slice(0, MAX_OPENAI_TOOL_ARGUMENT_VALUE_CHARS);
    case 'number':
      return Number.isFinite(value) ? value : null;
    case 'boolean':
      return value;
    case 'object':
      break;
    default:
      return undefined;
  }

  if (depth >= MAX_OPENAI_TOOL_ARGUMENT_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (let index = 0; index < value.length && items.length < MAX_OPENAI_TOOL_ARGUMENT_ARRAY_ITEMS; index += 1) {
      const item = normalizeToolArgumentJsonValue(value[index], depth + 1);
      items.push(item === undefined ? null : item);
    }
    return items;
  }

  const record = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  let keyCount = 0;
  for (const key in record) {
    if (keyCount >= MAX_OPENAI_TOOL_ARGUMENT_OBJECT_KEYS) break;
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const item = normalizeToolArgumentJsonValue(record[key], depth + 1);
    if (item === undefined) continue;
    output[key.slice(0, 128)] = item;
    keyCount += 1;
  }
  return output;
}

export function normalizeOpenAIToolArgumentsValue(value: unknown): string {
  if (typeof value === 'string') {
    return limitOpenAIToolArguments(value);
  }

  try {
    const normalized = normalizeToolArgumentJsonValue(value);
    const serialized = JSON.stringify(normalized ?? {});
    return serialized.length <= MAX_OPENAI_TOOL_ARGUMENT_CHARS ? serialized : '{}';
  } catch {
    return '{}';
  }
}

export function appendOpenAIToolArguments(existing: string, next: unknown): string {
  if (typeof next !== 'string' || existing.length >= MAX_OPENAI_TOOL_ARGUMENT_CHARS) {
    return existing;
  }

  const remaining = MAX_OPENAI_TOOL_ARGUMENT_CHARS - existing.length;
  return existing + next.slice(0, remaining);
}
