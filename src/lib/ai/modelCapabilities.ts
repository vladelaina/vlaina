import type { AIModel } from './types'

export function normalizeModelCapabilityText(value: string): string {
  return value
    .toLowerCase()
    .replace(/dall[·\s._:/-]*e/g, 'dall-e')
    .replace(/[\s._:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isStandaloneImageGenerationModel(model: Pick<AIModel, 'apiModelId' | 'name' | 'group'>): boolean {
  const normalized = normalizeModelCapabilityText(`${model.apiModelId} ${model.name} ${model.group ?? ''}`)

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
