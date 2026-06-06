import { ErrorCode } from './code'
import { MilkdownError } from './error'

export const MAX_EXCEPTION_SERIALIZED_DEPTH = 8
export const MAX_EXCEPTION_SERIALIZED_KEYS = 64
export const MAX_EXCEPTION_SERIALIZED_ARRAY_ITEMS = 128
export const MAX_EXCEPTION_SERIALIZED_VALUES = 1024
export const MAX_EXCEPTION_SERIALIZED_STRING_CHARS = 16 * 1024
export const MAX_EXCEPTION_SERIALIZED_OUTPUT_CHARS = 24 * 1024

interface SerializeBudget {
  values: number
  stringChars: number
}

type SerializeContext = 'root' | 'array' | 'object'

const serializeFunction = (value: Function) =>
  `[Function: ${value.name || 'anonymous'}]`

const serializeString = (value: string, budget: SerializeBudget): string => {
  const remaining = MAX_EXCEPTION_SERIALIZED_STRING_CHARS - budget.stringChars
  if (remaining <= 0) return JSON.stringify('[Truncated]')

  budget.stringChars += Math.min(value.length, remaining)
  return JSON.stringify(
    value.length > remaining
      ? `${value.slice(0, remaining)}...[truncated]`
      : value
  )
}

const serializeUnknown = (
  value: unknown,
  budget: SerializeBudget,
  seen: WeakSet<object>,
  depth: number,
  context: SerializeContext
): string | undefined => {
  budget.values += 1
  if (budget.values > MAX_EXCEPTION_SERIALIZED_VALUES) {
    return JSON.stringify('[Truncated]')
  }

  if (value === null) return 'null'

  const type = typeof value
  if (type === 'string') return serializeString(value as string, budget)
  if (type === 'number') return JSON.stringify(value) ?? 'null'
  if (type === 'boolean') return value ? 'true' : 'false'
  if (type === 'bigint') return JSON.stringify(`${String(value)}n`)
  if (type === 'function') return JSON.stringify(serializeFunction(value as Function))
  if (type === 'symbol') return JSON.stringify(String(value))
  if (type === 'undefined') return context === 'array' ? 'null' : undefined
  if (type !== 'object') return JSON.stringify(String(value))

  if (depth >= MAX_EXCEPTION_SERIALIZED_DEPTH) {
    return JSON.stringify('[MaxDepth]')
  }

  const object = value as object
  if (seen.has(object)) {
    return JSON.stringify('[Circular]')
  }
  seen.add(object)

  if (Array.isArray(value)) {
    const parts: string[] = []
    const limit = Math.min(value.length, MAX_EXCEPTION_SERIALIZED_ARRAY_ITEMS)
    for (let index = 0; index < limit; index += 1) {
      parts.push(
        serializeUnknown(value[index], budget, seen, depth + 1, 'array') ?? 'null'
      )
    }
    if (value.length > limit) {
      parts.push(JSON.stringify(`[${value.length - limit} more items]`))
    }
    return `[${parts.join(',')}]`
  }

  let keys: string[]
  try {
    keys = Object.keys(object)
  } catch {
    return JSON.stringify('[Unserializable]')
  }

  const parts: string[] = []
  const limit = Math.min(keys.length, MAX_EXCEPTION_SERIALIZED_KEYS)
  for (let index = 0; index < limit; index += 1) {
    const key = keys[index]
    const serialized = serializeUnknown(
      (value as Record<string, unknown>)[key],
      budget,
      seen,
      depth + 1,
      'object'
    )
    if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`)
  }
  if (keys.length > limit) {
    parts.push(`${JSON.stringify('...')}:${JSON.stringify(`[${keys.length - limit} more keys]`)}`)
  }

  return `{${parts.join(',')}}`
}

export const stringifyForMilkdownError = (value: unknown): string => {
  let result = serializeUnknown(
    value,
    { values: 0, stringChars: 0 },
    new WeakSet(),
    0,
    'root'
  ) ?? 'undefined'

  if (result.length > MAX_EXCEPTION_SERIALIZED_OUTPUT_CHARS) {
    result = `${result.slice(0, MAX_EXCEPTION_SERIALIZED_OUTPUT_CHARS)}...[truncated]`
  }

  return result
}

export function docTypeError(type: unknown) {
  return new MilkdownError(
    ErrorCode.docTypeError,
    `Doc type error, unsupported type: ${stringifyForMilkdownError(type)}`
  )
}

export function contextNotFound(name: string) {
  return new MilkdownError(
    ErrorCode.contextNotFound,
    `Context "${name}" not found, do you forget to inject it?`
  )
}

export function timerNotFound(name: string) {
  return new MilkdownError(
    ErrorCode.timerNotFound,
    `Timer "${name}" not found, do you forget to record it?`
  )
}

export function ctxCallOutOfScope() {
  return new MilkdownError(
    ErrorCode.ctxCallOutOfScope,
    'Should not call a context out of the plugin.'
  )
}

export function createNodeInParserFail(
  nodeType: object,
  attrs?: unknown,
  content?: unknown[]
) {
  const nodeTypeName = 'name' in nodeType ? nodeType.name : nodeType
  const heading = `Cannot create node for ${nodeTypeName}`
  const serialize = (x: unknown): string => {
    if (x == null) return 'null'

    if (Array.isArray(x)) {
      const limit = Math.min(x.length, MAX_EXCEPTION_SERIALIZED_ARRAY_ITEMS)
      const items = x.slice(0, limit).map(serialize)
      if (x.length > limit) items.push(`[${x.length - limit} more items]`)
      return `[${items.join(', ')}]`
    }

    if (typeof x === 'object') {
      if ('toJSON' in x && typeof (x as any).toJSON === 'function') {
        try {
          return stringifyForMilkdownError((x as any).toJSON())
        } catch {
          return '[Unserializable]'
        }
      }

      if ('spec' in x) {
        return stringifyForMilkdownError((x as any).spec)
      }

      return stringifyForMilkdownError(x)
    }

    if (
      typeof x === 'string' ||
      typeof x === 'number' ||
      typeof x === 'boolean'
    ) {
      return stringifyForMilkdownError(x)
    }

    if (typeof x === 'function') {
      return `[Function: ${(x as Function).name || 'anonymous'}]`
    }

    try {
      return String(x)
    } catch {
      return '[Unserializable]'
    }
  }

  const headingMessage = ['[Description]', heading] as const
  const attrsMessage = ['[Attributes]', attrs] as const
  const contentMessage = [
    '[Content]',
    (content ?? []).map((node) => {
      if (!node) return 'null'

      if (typeof node === 'object' && 'type' in node) {
        return `${node}`
      }

      return serialize(node)
    }),
  ] as const

  const messages = [headingMessage, attrsMessage, contentMessage].reduce(
    (acc, [title, value]) => {
      const message = `${title}: ${serialize(value)}.`
      return acc.concat(message)
    },
    [] as string[]
  )

  return new MilkdownError(
    ErrorCode.createNodeInParserFail,
    messages.join('\n')
  )
}

export function stackOverFlow() {
  return new MilkdownError(
    ErrorCode.stackOverFlow,
    'Stack over flow, cannot pop on an empty stack.'
  )
}

export function parserMatchError(node: unknown) {
  return new MilkdownError(
    ErrorCode.parserMatchError,
    `Cannot match target parser for node: ${stringifyForMilkdownError(node)}.`
  )
}

export function serializerMatchError(node: unknown) {
  return new MilkdownError(
    ErrorCode.serializerMatchError,
    `Cannot match target serializer for node: ${stringifyForMilkdownError(node)}.`
  )
}

export function getAtomFromSchemaFail(type: 'mark' | 'node', name: string) {
  return new MilkdownError(
    ErrorCode.getAtomFromSchemaFail,
    `Cannot get ${type}: ${name} from schema.`
  )
}

export function expectDomTypeError(node: unknown) {
  return new MilkdownError(
    ErrorCode.expectDomTypeError,
    `Expect to be a dom, but get: ${stringifyForMilkdownError(node)}.`
  )
}

export function callCommandBeforeEditorView() {
  return new MilkdownError(
    ErrorCode.callCommandBeforeEditorView,
    "You're trying to call a command before editor view initialized, make sure to get commandManager from ctx after editor view has been initialized"
  )
}

export function missingRootElement() {
  return new MilkdownError(
    ErrorCode.missingRootElement,
    'Missing root element, milkdown cannot find root element of the editor.'
  )
}

export function missingNodeInSchema(name: string) {
  return new MilkdownError(
    ErrorCode.missingNodeInSchema,
    `Missing node in schema, milkdown cannot find "${name}" in schema.`
  )
}

export function missingMarkInSchema(name: string) {
  return new MilkdownError(
    ErrorCode.missingMarkInSchema,
    `Missing mark in schema, milkdown cannot find "${name}" in schema.`
  )
}

export function ctxNotBind() {
  return new MilkdownError(
    ErrorCode.ctxNotBind,
    'Context not bind, please make sure the plugin has been initialized.'
  )
}

export function missingYjsDoc() {
  return new MilkdownError(
    ErrorCode.missingYjsDoc,
    'Missing yjs doc, please make sure you have bind one.'
  )
}
