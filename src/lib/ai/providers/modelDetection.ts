import type { Provider } from '../types'
import { buildAnthropicBaseUrl, buildOpenAIBaseUrl } from '../utils'
import { providerFetch } from '../providerHttp'
import { buildAnthropicHeaders } from './anthropic'

export type ProviderEndpointType = NonNullable<Provider['endpointType']>

export interface ModelFetchResult {
  models: string[]
  endpointType: ProviderEndpointType
}

export async function detectProviderEndpointModels(provider: Provider, apiKey: string): Promise<ModelFetchResult> {
  const orderedEndpointTypes: ProviderEndpointType[] = provider.endpointType === 'anthropic'
    ? ['anthropic', 'openai']
    : ['openai', 'anthropic']

  let lastError: unknown
  for (const endpointType of orderedEndpointTypes) {
    try {
      const models = endpointType === 'anthropic'
        ? await getAnthropicModels(provider, apiKey)
        : await getOpenAIModels(provider, apiKey)

      return { models, endpointType }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch models')
}

async function getOpenAIModels(provider: Provider, apiKey: string): Promise<string[]> {
  const url = `${buildOpenAIBaseUrl(provider.apiHost)}/models`
  const response = await fetchModelResponse(url, {
    Authorization: `Bearer ${apiKey}`,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAI-compatible models: ${response.status}`)
  }

  const data = await response.json()
  if (data.data && Array.isArray(data.data)) {
    return data.data.map((model: any) => model.id)
  }
  if (data.models && Array.isArray(data.models)) {
    return data.models.map((model: any) => model.name || model.model)
  }

  return []
}

async function getAnthropicModels(provider: Provider, apiKey: string): Promise<string[]> {
  const url = `${buildAnthropicBaseUrl(provider.apiHost)}/models`
  const response = await fetchModelResponse(url, buildAnthropicHeaders(apiKey))

  if (!response.ok) {
    throw new Error(`Failed to fetch Anthropic models: ${response.status}`)
  }

  const data = await response.json()
  if (data.data && Array.isArray(data.data)) {
    return data.data.map((model: any) => model.id).filter((id: unknown): id is string => typeof id === 'string')
  }

  return []
}

async function fetchModelResponse(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    return await providerFetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}
