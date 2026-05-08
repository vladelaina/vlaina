import type { AIModel } from '@/lib/ai/types'
import { getModelDisplayName } from './modelFamilyRegistry'

type SortableModel = Pick<AIModel, 'apiModelId' | 'name' | 'createdAt'>

const TIER_PATTERNS: Array<[RegExp, number]> = [
  [/(^|[\s._:/-])(opus|ultra)([\s._:/-]|$)/, 900],
  [/(^|[\s._:/-])(max)([\s._:/-]|$)/, 850],
  [/(^|[\s._:/-])(pro)([\s._:/-]|$)/, 800],
  [/(^|[\s._:/-])(plus)([\s._:/-]|$)/, 720],
  [/(^|[\s._:/-])(sonnet)([\s._:/-]|$)/, 680],
  [/(^|[\s._:/-])(r1|reasoning|think|thinking)([\s._:/-]|$)/, 640],
  [/(^|[\s._:/-])(flash)([\s._:/-]|$)/, 520],
  [/(^|[\s._:/-])(haiku)([\s._:/-]|$)/, 420],
  [/(^|[\s._:/-])(mini|lite|nano|small|tiny)([\s._:/-]|$)/, 260],
]

const DATE_PATTERNS = [
  /\b(20\d{2})[-_.:/](0?[1-9]|1[0-2])[-_.:/](0?[1-9]|[12]\d|3[01])\b/g,
  /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g,
  /\b(0?[1-9]|1[0-2])[-_.:/](20\d{2})\b/g,
  /\b(2[4-9])(0[1-9]|1[0-2])\b/g,
  /\b(0[1-9]|1[0-2])([0-2]\d|3[01])\b/g,
]

function getModelSortValue(model: SortableModel): string {
  return `${getModelDisplayName(model)} ${model.apiModelId}`.toLowerCase()
}

function stripNonVersionNumbers(value: string): string {
  return value
    .replace(/\b20\d{2}[-_.:/](0?[1-9]|1[0-2])[-_.:/](0?[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b20\d{6}\b/g, ' ')
    .replace(/\b0?\d[-_.:/]20\d{2}\b/g, ' ')
    .replace(/\b2[4-9](0[1-9]|1[0-2])\b/g, ' ')
    .replace(/\b(0[1-9]|1[0-2])([0-2]\d|3[01])\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?[tbm](?=$|[^\w])/g, ' ')
    .replace(/\b\d+(?:\.\d+)?k(?=$|[^\w])/g, ' ')
}

function extractVersionParts(value: string): number[] {
  const versionValue = stripNonVersionNumbers(value)
  const parts: number[] = []
  const regex = /(?:^|[^\d])(\d+(?:\.\d+)?)(?!\d)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(versionValue))) {
    const part = Number(match[1])
    if (!Number.isFinite(part) || part > 100) {
      continue
    }
    parts.push(part)
    if (parts.length >= 3) {
      break
    }
  }

  return parts
}

function compareVersionParts(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0
    const rightPart = right[index] ?? 0
    if (leftPart !== rightPart) {
      return rightPart - leftPart
    }
  }

  return 0
}

function getTierScore(value: string): number {
  for (const [pattern, score] of TIER_PATTERNS) {
    if (pattern.test(value)) {
      return score
    }
  }

  return 500
}

function getRouteStatusScore(value: string): number {
  if (/(^|[\s._:/-])latest([\s._:/-]|$)/.test(value)) {
    return 40
  }
  if (/(^|[\s._:/-])(free|experimental)([\s._:/-]|$)/.test(value)) {
    return -40
  }
  if (/(^|[\s._:/-])(preview|beta|alpha|exp)([\s._:/-]|$)/.test(value)) {
    return -20
  }
  if (getReleaseDateScore(value) > 0) {
    return 10
  }

  return 20
}

function toDateScore(year: number, month: number, day: number): number {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return 0
  }
  return year * 10_000 + month * 100 + day
}

function getReleaseDateScore(value: string): number {
  let bestScore = 0

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(value))) {
      let score = 0
      if (pattern === DATE_PATTERNS[0]) {
        score = toDateScore(Number(match[1]), Number(match[2]), Number(match[3]))
      } else if (pattern === DATE_PATTERNS[1]) {
        score = toDateScore(Number(match[1]), Number(match[2]), Number(match[3]))
      } else if (pattern === DATE_PATTERNS[2]) {
        score = toDateScore(Number(match[2]), Number(match[1]), 1)
      } else if (pattern === DATE_PATTERNS[3]) {
        score = toDateScore(2000 + Number(match[1]), Number(match[2]), 1)
      } else {
        score = toDateScore(2025, Number(match[1]), Number(match[2]))
      }
      bestScore = Math.max(bestScore, score)
    }
  }

  return bestScore
}

function getParameterSizeScore(value: string): number {
  const regex = /(?:^|[^\d])(\d+(?:\.\d+)?)(t|b|m)(?=$|[^\w])/g
  let bestScore = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(value))) {
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) {
      continue
    }

    const unit = match[2]
    const score =
      unit === 't'
        ? amount * 1_000_000
        : unit === 'b'
          ? amount * 1_000
          : amount
    bestScore = Math.max(bestScore, score)
  }

  return bestScore
}

function getContextWindowScore(value: string): number {
  const regex = /(?:^|[^\d])(\d+(?:\.\d+)?)(k|m)(?=$|[^\w])/g
  let bestScore = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(value))) {
    const amount = Number(match[1])
    if (!Number.isFinite(amount)) {
      continue
    }

    const unit = match[2]
    const score = unit === 'm' ? amount * 1_000 : amount
    bestScore = Math.max(bestScore, score)
  }

  return bestScore
}

export function compareModelDisplayOrder(left: SortableModel, right: SortableModel): number {
  const leftValue = getModelSortValue(left)
  const rightValue = getModelSortValue(right)

  const versionComparison = compareVersionParts(
    extractVersionParts(leftValue),
    extractVersionParts(rightValue),
  )
  if (versionComparison !== 0) {
    return versionComparison
  }

  const tierComparison = getTierScore(rightValue) - getTierScore(leftValue)
  if (tierComparison !== 0) {
    return tierComparison
  }

  const routeStatusComparison = getRouteStatusScore(rightValue) - getRouteStatusScore(leftValue)
  if (routeStatusComparison !== 0) {
    return routeStatusComparison
  }

  const dateComparison = getReleaseDateScore(rightValue) - getReleaseDateScore(leftValue)
  if (dateComparison !== 0) {
    return dateComparison
  }

  const sizeComparison = getParameterSizeScore(rightValue) - getParameterSizeScore(leftValue)
  if (sizeComparison !== 0) {
    return sizeComparison
  }

  const contextComparison = getContextWindowScore(rightValue) - getContextWindowScore(leftValue)
  if (contextComparison !== 0) {
    return contextComparison
  }

  const nameComparison = getModelDisplayName(left).localeCompare(getModelDisplayName(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
  if (nameComparison !== 0) {
    return nameComparison
  }

  return left.createdAt - right.createdAt
}

export function sortModelsForDisplay<T extends SortableModel>(models: T[]): T[] {
  return [...models].sort(compareModelDisplayOrder)
}
