import type { AIModel } from '@/lib/ai/types'
import cohereIcon from '@/components/Chat/assets/providers/cohere.png'
import mistralIcon from '@/components/Chat/assets/providers/mistral.png'
import perplexityIcon from '@/components/Chat/assets/providers/perplexity.png'
import anthropicIcon from '@/components/Chat/assets/model-families/anthropic.svg'
import deepseekIcon from '@/components/Chat/assets/model-families/deepseek.svg'
import doubaoIcon from '@/components/Chat/assets/model-families/doubao.svg'
import gemmaIcon from '@/components/Chat/assets/model-families/gemma.svg'
import geminiIcon from '@/components/Chat/assets/model-families/gemini.svg'
import grokIcon from '@/components/Chat/assets/model-families/grok.svg'
import kimiIcon from '@/components/Chat/assets/model-families/kimi.svg'
import llamaIcon from '@/components/Chat/assets/model-families/llama.svg'
import longcatIcon from '@/components/Chat/assets/model-families/longcat.svg'
import mimoIcon from '@/components/Chat/assets/model-families/xiaomi-mimo.svg'
import minimaxIcon from '@/components/Chat/assets/model-families/minimax.svg'
import openaiIcon from '@/components/Chat/assets/model-families/openai.svg'
import qwenIcon from '@/components/Chat/assets/model-families/qwen.svg'
import zhipuIcon from '@/components/Chat/assets/model-families/zhipu.svg'

export type ModelFamilyId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'grok'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'zhipu'
  | 'minimax'
  | 'doubao'
  | 'gemma'
  | 'llama'
  | 'longcat'
  | 'mimo'
  | 'mistral'
  | 'perplexity'
  | 'cohere'

export type ModelCategoryId = 'favorites' | ModelFamilyId | 'custom'

export type ModelFamily = {
  id: ModelFamilyId
  name: string
  icon: string
  matcher: (value: string) => boolean
}

export type ModelCategory = {
  id: ModelCategoryId
  name: string
  icon: string | null
  kind: 'favorites' | 'family' | 'custom'
  count: number
}

export const MODEL_FAMILIES: ModelFamily[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: openaiIcon,
    matcher: (value) => (
      value.includes('gpt') ||
      value.includes('chatgpt') ||
      value.includes('dall-e') ||
      /\bo[1345](?:[\s._:/-]|$)/.test(value)
    ),
  },
  {
    id: 'anthropic',
    name: 'Claude',
    icon: anthropicIcon,
    matcher: (value) => value.includes('claude') || value.includes('anthropic'),
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: geminiIcon,
    matcher: (value) => value.includes('gemini') || value.includes('palm'),
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: grokIcon,
    matcher: (value) => value.includes('grok'),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: deepseekIcon,
    matcher: (value) => value.includes('deepseek'),
  },
  {
    id: 'qwen',
    name: 'Qwen',
    icon: qwenIcon,
    matcher: (value) => value.includes('qwen') || value.includes('dashscope') || value.includes('wan-'),
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    icon: kimiIcon,
    matcher: (value) => value.includes('moonshot') || value.includes('kimi'),
  },
  {
    id: 'zhipu',
    name: 'Z.ai',
    icon: zhipuIcon,
    matcher: (value) => value.includes('glm') || value.includes('zhipu'),
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: minimaxIcon,
    matcher: (value) => value.includes('minimax') || value.includes('abab'),
  },
  {
    id: 'doubao',
    name: 'Doubao',
    icon: doubaoIcon,
    matcher: (value) => value.includes('doubao'),
  },
  {
    id: 'gemma',
    name: 'Gemma',
    icon: gemmaIcon,
    matcher: (value) => value.includes('gemma'),
  },
  {
    id: 'llama',
    name: 'Llama',
    icon: llamaIcon,
    matcher: (value) => /(^|[\s._:/-])(?:meta[\s._:/-])?l(?:l|i)ama(?:\d|[\s._:/-]|$)/.test(value),
  },
  {
    id: 'longcat',
    name: 'LongCat',
    icon: longcatIcon,
    matcher: (value) => /long[\s._-]?cat/.test(value),
  },
  {
    id: 'mimo',
    name: 'Xiaomi',
    icon: mimoIcon,
    matcher: (value) => value.includes('mimo') || value.includes('xiaomi'),
  },
  {
    id: 'mistral',
    name: 'Mistral',
    icon: mistralIcon,
    matcher: (value) => value.includes('mistral') || value.includes('mixtral') || value.includes('codestral'),
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    icon: perplexityIcon,
    matcher: (value) => value.includes('perplexity') || value.includes('sonar'),
  },
  {
    id: 'cohere',
    name: 'Cohere',
    icon: cohereIcon,
    matcher: (value) => value.includes('command') || value.includes('cohere'),
  },
]

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

export function getModelSearchValue(model: AIModel): string {
  return `${model.name} ${model.apiModelId} ${model.group ?? ''}`.toLowerCase()
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
  const slashIndex = displayName.indexOf('/')
  if (slashIndex <= 0 || slashIndex === displayName.length - 1) {
    return displayName
  }

  const prefix = displayName.slice(0, slashIndex).trim().toLowerCase()
  if (!KNOWN_MODEL_PREFIXES.has(prefix)) {
    return displayName
  }

  return displayName.slice(slashIndex + 1)
}
