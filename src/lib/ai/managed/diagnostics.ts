import { hasElectronDesktopBridge } from '@/lib/desktop/backend';

import { getManagedServiceErrorMessage } from './errors';
import type { ManagedBudgetSnapshot, ManagedBudgetStatus, ManagedRuntime } from './types';

type ManagedClientDiagnostic = Record<string, unknown>

let managedDiagnosticCounter = 0
let lastManagedBudgetSnapshot: ManagedBudgetSnapshot | null = null

export function logManagedClientDiagnostic(event: string, details: ManagedClientDiagnostic): void {
  void event
  void details
}

export function getManagedRuntime(): ManagedRuntime {
  return hasElectronDesktopBridge() ? 'desktop' : 'web'
}

export function createManagedDiagnosticId(prefix: string): string {
  managedDiagnosticCounter += 1
  return `${prefix}-${Date.now()}-${managedDiagnosticCounter}`
}

export function toIsoTimestamp(value: number): string {
  return new Date(value).toISOString()
}

export function captureManagedBudgetSnapshot(
  budget: ManagedBudgetStatus,
  requestId: string,
  capturedAt: number
): void {
  lastManagedBudgetSnapshot = {
    ...budget,
    requestId,
    capturedAt,
    runtime: getManagedRuntime(),
  }
}

export function buildBudgetContext(now: number): Record<string, unknown> {
  if (!lastManagedBudgetSnapshot) {
    return {
      budgetSnapshotKnown: false,
    }
  }

  return {
    budgetSnapshotKnown: true,
    budgetSnapshotRequestId: lastManagedBudgetSnapshot.requestId,
    budgetSnapshotRuntime: lastManagedBudgetSnapshot.runtime,
    budgetSnapshotCapturedAt: toIsoTimestamp(lastManagedBudgetSnapshot.capturedAt),
    budgetSnapshotAgeMs: now - lastManagedBudgetSnapshot.capturedAt,
    budgetActive: lastManagedBudgetSnapshot.active,
    budgetStatus: lastManagedBudgetSnapshot.status,
    budgetUsedPercent: lastManagedBudgetSnapshot.usedPercent,
    budgetRemainingPercent: lastManagedBudgetSnapshot.remainingPercent,
  }
}

export function summarizeManagedError(error: unknown): Record<string, unknown> {
  const message = getManagedServiceErrorMessage(error)

  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: message,
      errorStackPreview: error.stack?.split('\n').slice(0, 3).join(' | ') ?? null,
      isAbort: error.name === 'AbortError',
    }
  }

  if (error && typeof error === 'object') {
    return {
      errorName: null,
      errorMessage: message,
      errorKeys: Object.keys(error as Record<string, unknown>).slice(0, 8),
      isAbort: message.toLowerCase().includes('abort'),
    }
  }

  return {
    errorName: null,
    errorMessage: message,
    errorStackPreview: null,
    isAbort: message.toLowerCase().includes('abort'),
  }
}

export function summarizeManagedChatBody(body: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(body.messages) ? body.messages : []
  const messageOutline = messages.map((entry, index) => summarizeManagedMessage(entry, index))
  const roles = messageOutline.map((entry) => entry.role)
  const lastMessage = messageOutline[messageOutline.length - 1] ?? null
  const totalTextLength = messageOutline.reduce((sum, entry) => {
    const value = typeof entry.textLength === 'number' ? entry.textLength : 0
    return sum + value
  }, 0)

  return {
    model: typeof body.model === 'string' ? body.model : null,
    stream: body.stream === true,
    messageCount: messages.length,
    temperature: typeof body.temperature === 'number' ? body.temperature : null,
    maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : null,
    toolCount: Array.isArray(body.tools) ? body.tools.length : 0,
    hasTools: Array.isArray(body.tools) && body.tools.length > 0,
    toolChoice:
      typeof body.tool_choice === 'string'
        ? body.tool_choice
        : body.tool_choice && typeof body.tool_choice === 'object'
          ? 'object'
          : null,
    roleSequence: roles.join(' > ') || null,
    totalTextLength,
    lastMessageRole: lastMessage && typeof lastMessage.role === 'string' ? lastMessage.role : null,
    lastMessageTextLength:
      lastMessage && typeof lastMessage.textLength === 'number' ? lastMessage.textLength : null,
    lastMessageContentType:
      lastMessage && typeof lastMessage.contentType === 'string' ? lastMessage.contentType : null,
    messageOutline: messageOutline.slice(-6),
  }
}

function summarizeManagedMessage(entry: unknown, index: number): Record<string, unknown> {
  if (!entry || typeof entry !== 'object') {
    return {
      index,
      role: 'invalid',
      contentType: 'invalid',
      textLength: 0,
      partCount: null,
      nonTextPartCount: 0,
      partTypes: [],
    }
  }

  const value = entry as Record<string, unknown>
  const contentSummary = summarizeManagedMessageContent(value.content)

  return {
    index,
    role: typeof value.role === 'string' ? value.role : 'unknown',
    ...contentSummary,
  }
}

function summarizeManagedMessageContent(content: unknown): Record<string, unknown> {
  if (typeof content === 'string') {
    return {
      contentType: 'text',
      textLength: content.length,
      partCount: null,
      nonTextPartCount: 0,
      partTypes: ['text'],
    }
  }

  if (!Array.isArray(content)) {
    return {
      contentType: content == null ? 'empty' : typeof content,
      textLength: 0,
      partCount: null,
      nonTextPartCount: 0,
      partTypes: [],
    }
  }

  let textLength = 0
  let nonTextPartCount = 0
  const partTypes: string[] = []

  for (const part of content) {
    if (typeof part === 'string') {
      textLength += part.length
      partTypes.push('text')
      continue
    }

    if (!part || typeof part !== 'object') {
      partTypes.push(typeof part)
      nonTextPartCount += 1
      continue
    }

    const value = part as Record<string, unknown>
    const type = typeof value.type === 'string' ? value.type : 'object'
    partTypes.push(type)

    if (typeof value.text === 'string') {
      textLength += value.text.length
      continue
    }

    if (typeof value.input_text === 'string') {
      textLength += value.input_text.length
      continue
    }

    nonTextPartCount += 1
  }

  return {
    contentType: 'parts',
    textLength,
    partCount: content.length,
    nonTextPartCount,
    partTypes: partTypes.slice(0, 8),
  }
}
