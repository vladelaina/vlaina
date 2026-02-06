import type { AIModel } from './types'

export function generateModelName(modelId: string): string {
  const parts = modelId.split(/[-_/]/)
  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function generateModelGroup(modelId: string): string {
  const lowerModelId = modelId.toLowerCase()
  
  if (lowerModelId.includes('gpt-4')) return 'GPT-4'
  if (lowerModelId.includes('gpt-3.5')) return 'GPT-3.5'
  if (lowerModelId.includes('gpt-3')) return 'GPT-3'
  if (lowerModelId.includes('claude-3-opus')) return 'Claude 3 Opus'
  if (lowerModelId.includes('claude-3-sonnet')) return 'Claude 3 Sonnet'
  if (lowerModelId.includes('claude-3-haiku')) return 'Claude 3 Haiku'
  if (lowerModelId.includes('claude-3')) return 'Claude 3'
  if (lowerModelId.includes('claude-2')) return 'Claude 2'
  if (lowerModelId.includes('claude')) return 'Claude'
  if (lowerModelId.includes('gemini-pro')) return 'Gemini Pro'
  if (lowerModelId.includes('gemini')) return 'Gemini'
  if (lowerModelId.includes('llama')) return 'Llama'
  if (lowerModelId.includes('mistral')) return 'Mistral'
  if (lowerModelId.includes('mixtral')) return 'Mixtral'
  
  return 'Other'
}

export function groupModels(models: AIModel[]): Record<string, AIModel[]> {
  return models.reduce((acc, model) => {
    const group = model.group || 'Other'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(model)
    return acc
  }, {} as Record<string, AIModel[]>)
}

export function validateApiHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '•'.repeat(apiKey.length)
  }
  return apiKey.slice(0, 4) + '•'.repeat(apiKey.length - 8) + apiKey.slice(-4)
}

export function normalizeApiHost(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}
