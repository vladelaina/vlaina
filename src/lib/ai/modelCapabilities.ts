import type { AIModel } from './types'

export const MAX_MODEL_CAPABILITY_FIELD_CHARS = 4096
export const MAX_MODEL_CAPABILITY_TEXT_CHARS = 8192

export function normalizeModelCapabilityText(value: string): string {
  return value
    .slice(0, MAX_MODEL_CAPABILITY_TEXT_CHARS)
    .toLowerCase()
    .replace(/dall[·\s._:/-]*e/g, 'dall-e')
    .replace(/[\s._:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getModelCapabilityField(value: string | undefined): string {
  return (value ?? '').slice(0, MAX_MODEL_CAPABILITY_FIELD_CHARS)
}

export function isStandaloneImageGenerationModel(model: Pick<AIModel, 'apiModelId' | 'name' | 'group'>): boolean {
  const normalized = normalizeModelCapabilityText([
    getModelCapabilityField(model.apiModelId),
    getModelCapabilityField(model.name),
    getModelCapabilityField(model.group),
  ].join(' '))

  return [
    /(?:^|-)gpt-image(?:-|$)/,
    /(?:^|-)dall-e(?:-|$)/,
    /(?:^|-)imagen(?:-\d|$)/,
    /(?:^|-)flux(?:-\d|$)/,
    /(?:^|-)stable-diffusion(?:-|$)/,
    /(?:^|-)stable-image(?:-|$)/,
    /(?:^|-)sd(?:xl|3|3-5|-|$)/,
    /(?:^|-)qwen-image(?:-|$)/,
    /(?:^|-)seedream(?:-|$)/,
    /(?:^|-)ideogram(?:-|$)/,
    /(?:^|-)midjourney(?:-|$)/,
    /(?:^|-)mj(?:-|$)/,
    /(?:^|-)hidream(?:-|$)/,
    /(?:^|-)recraft(?:-|$)/,
    /(?:^|-)leonardo(?:-|$)/,
  ].some((pattern) => pattern.test(normalized))
}
