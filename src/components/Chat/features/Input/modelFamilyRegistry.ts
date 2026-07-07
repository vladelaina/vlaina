import type { AIModel } from '@/lib/ai/types'
import {
  MODEL_FAMILIES,
  type ModelFamily,
  type ModelFamilyId,
} from './modelFamilyDefinitions'

export { MODEL_FAMILIES, type ModelFamily, type ModelFamilyId } from './modelFamilyDefinitions'

export type ModelCategoryId = 'favorites' | ModelFamilyId | 'custom'

export type ModelCategory = {
  id: ModelCategoryId
  name: string
  icon: string | null
  monochromeIcon?: boolean
  kind: 'favorites' | 'family' | 'custom'
  count: number
}

const MAX_MODEL_FAMILY_FIELD_SCAN_CHARS = 4096
const MAX_MODEL_FAMILY_SEARCH_VALUE_CHARS = 8192
const MAX_MODEL_PRESENTATION_NAME_CHARS = 8192

const KNOWN_MODEL_PREFIXES = new Set([
  '01-ai',
  'ai21',
  'alibaba',
  'anthropic',
  'baichuan',
  'bytedance',
  'cohere',
  'deepseek',
  'doubao',
  'glm',
  'google',
  'grok',
  'hunyuan',
  'kimi',
  'liama',
  'llama',
  'longcat',
  'gemma',
  'meta',
  'microsoft',
  'minimax',
  'mimo',
  'mistral',
  'moonshot',
  'openai',
  'perplexity',
  'qwen',
  'tencent',
  'x-ai',
  'xiaomi',
  'xai',
  'yi',
  'zhipu',
])

function getModelFamilyScanText(value: string | undefined): string {
  return (value ?? '').slice(0, MAX_MODEL_FAMILY_FIELD_SCAN_CHARS)
}

export function getModelSearchValue(model: AIModel): string {
  return [
    getModelFamilyScanText(model.name),
    getModelFamilyScanText(model.apiModelId),
    getModelFamilyScanText(model.group),
  ].join(' ').slice(0, MAX_MODEL_FAMILY_SEARCH_VALUE_CHARS).toLowerCase()
}

export function getModelFamily(model: AIModel): ModelFamily | null {
  const value = getModelSearchValue(model)
  return MODEL_FAMILIES.find((family) => family.matcher(value)) ?? null
}

export function getModelCategoryId(model: AIModel): ModelFamilyId | 'custom' {
  return getModelFamily(model)?.id ?? 'custom'
}

export function getModelDisplayName(model: Pick<AIModel, 'name' | 'apiModelId'>): string {
  const displayName = model.name || model.apiModelId
  const scanText = displayName.slice(0, MAX_MODEL_FAMILY_FIELD_SCAN_CHARS + 1)
  const slashIndex = scanText.indexOf('/')
  if (slashIndex <= 0 || slashIndex === displayName.length - 1) {
    return displayName
  }

  const prefix = displayName.slice(0, slashIndex).trim().toLowerCase()
  if (!KNOWN_MODEL_PREFIXES.has(prefix)) {
    return displayName
  }

  return displayName.slice(slashIndex + 1)
}

function prefixDisplayName(displayName: string, prefix: string): string {
  const normalized = displayName.slice(0, MAX_MODEL_PRESENTATION_NAME_CHARS).trim()
  const lower = normalized.toLowerCase()
  const lowerPrefix = prefix.toLowerCase()

  if (!lower.startsWith(lowerPrefix)) {
    return normalized
  }

  const rest = normalized.slice(prefix.length)
  if (!rest) {
    return prefix
  }

  if (/^[\s._:/-]/.test(rest)) {
    return `${prefix}${rest}`
  }

  return `${prefix}-${rest}`
}

export function getModelPresentationName(model: Pick<AIModel, 'name' | 'apiModelId'>): string {
  const rawName = model.name || model.apiModelId
  const displayName = getModelDisplayName(model)
  const displayNameForPresentation = displayName.slice(0, MAX_MODEL_PRESENTATION_NAME_CHARS)
  const rawNameScan = rawName.slice(0, MAX_MODEL_FAMILY_FIELD_SCAN_CHARS)
  const displayNameScan = displayName.slice(0, MAX_MODEL_FAMILY_FIELD_SCAN_CHARS)

  if (/^gpt(?=$|[\s._:/-]|\d|[a-z])/i.test(displayNameScan)) {
    return prefixDisplayName(displayNameForPresentation, 'GPT')
  }

  if (/^deepseek(?=$|[\s._:/-]|[a-z])/i.test(displayNameScan)) {
    return prefixDisplayName(displayNameForPresentation, 'DeepSeek')
  }

  if (/^minimax(?=$|[\s._:/-]|[a-z])/i.test(displayNameScan)) {
    return prefixDisplayName(displayNameForPresentation, 'MiniMax')
  }

  if (/^grok(?=$|[\s._:/-]|[a-z])/i.test(displayNameScan)) {
    return prefixDisplayName(displayNameForPresentation, 'Grok')
  }

  if (/llama/i.test(rawNameScan)) {
    if (/^llama(?=$|[\s._:/-]|\d|[a-z])/i.test(displayNameScan)) {
      return prefixDisplayName(displayNameForPresentation, 'Llama')
    }

    const slashIndex = rawNameScan.indexOf('/')
    if (slashIndex > 0 && slashIndex < rawName.length - 1) {
      return prefixDisplayName(
        rawName.slice(slashIndex + 1, slashIndex + 1 + MAX_MODEL_PRESENTATION_NAME_CHARS),
        'Llama',
      )
    }
  }

  if (/^qwen(?=\d|[a-z])/i.test(displayNameScan)) {
    const rest = displayNameForPresentation.slice(4)
    if (/^\d/.test(rest)) {
      return `Qwen${rest}`
    }
    return prefixDisplayName(displayNameForPresentation, 'Qwen')
  }

  if (/^(moonshot|kimi)(?=$|[\s._:/-]|[a-z])/i.test(displayNameScan)) {
    return prefixDisplayName(displayNameForPresentation.replace(/^moonshot/i, 'Kimi'), 'Kimi')
  }

  if (/^(glm|zhipu)(?=$|[\s._:/-]|[a-z])/i.test(displayNameScan)) {
    return prefixDisplayName(displayNameForPresentation.replace(/^zhipu/i, 'GLM'), 'GLM')
  }

  return displayNameForPresentation
}
