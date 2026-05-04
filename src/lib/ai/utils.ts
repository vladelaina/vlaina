import type { AIModel } from './types'

export function buildScopedModelId(providerId: string, apiModelId: string): string {
  return `${providerId}::${apiModelId}`
}

export function resolveApiModelId(model: Pick<AIModel, 'apiModelId'>): string {
  return model.apiModelId
}

export function generateModelName(modelId: string): string {
  const parts = modelId.split(/[-_/]/)
  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function generateModelGroup(modelId: string): string {
  const lower = modelId.toLowerCase()
  
  if (lower.includes('gpt') || lower.includes('o1-') || lower.includes('dall-e') || lower.includes('chatgpt')) return 'OpenAI'
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Anthropic'
  if (lower.includes('gemini') || lower.includes('palm')) return 'Google Gemini'
  if (lower.includes('deepseek')) return 'DeepSeek'
  if (lower.includes('qwen') || lower.includes('dashscope') || lower.includes('wan-')) return 'Qwen'
  if (lower.includes('llama')) return 'Llama'
  if (lower.includes('mistral') || lower.includes('mixtral') || lower.includes('codestral')) return 'Mistral'
  if (lower.includes('hunyuan')) return 'Hunyuan'
  if (lower.includes('doubao')) return 'Doubao'
  if (lower.includes('minimax') || lower.includes('abab')) return 'MiniMax'
  if (lower.includes('yi-') || lower.includes('01-ai')) return 'Yi (01.AI)'
  if (lower.includes('moonshot') || lower.includes('kimi')) return 'Moonshot'
  if (lower.includes('glm') || lower.includes('zhipu')) return 'Zhipu GLM'
  if (lower.includes('baichuan')) return 'Baichuan'
  if (lower.includes('internlm')) return 'InternLM'
  if (lower.includes('flux')) return 'Flux'
  if (lower.includes('midjourney') || lower.includes('mj-')) return 'Midjourney'
  if (lower.includes('suno')) return 'Suno'
  if (lower.includes('luma')) return 'Luma'
  if (lower.includes('grok')) return 'Grok'
  if (lower.includes('perplexity') || lower.includes('sonar')) return 'Perplexity'
  if (lower.includes('command')) return 'Cohere'
  
  let group = modelId;
  if (modelId.includes('/')) {
    group = modelId.split('/')[0];
  } else if (modelId.includes(':')) {
    group = modelId.split(':')[0];
  } else if (modelId.includes('-')) {
    const parts = modelId.split('-');
    if (parts[0].length > 2) {
        group = parts[0];
    }
  }

  if (group && group.length > 0) {
      return group.charAt(0).toUpperCase() + group.slice(1);
  }
  
  return 'Other'
}

export function normalizeApiHost(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}

export function buildOpenAIBaseUrl(url: string): string {
  const normalizedHost = normalizeApiHost(url)
    .replace(/\/(chat\/completions|responses|embeddings|images\/generations|models)$/i, '')
    .replace(/\/v1$/i, '')

  return `${normalizedHost}/v1`
}

export function buildAnthropicBaseUrl(url: string): string {
  const normalizedHost = normalizeApiHost(url)
    .replace(/\/(messages|models)$/i, '')
    .replace(/\/v1$/i, '')

  return `${normalizedHost}/v1`
}
