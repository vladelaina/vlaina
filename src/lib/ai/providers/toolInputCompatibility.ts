import type { ChatMessageContent } from '../types'

export function isTextOnlyMessage(content: ChatMessageContent): boolean {
  return typeof content === 'string' || content.every((part) => part.type === 'text')
}

export function isToolInputUnsupported(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const errorCode = typeof (error as { errorCode?: unknown }).errorCode === 'string'
    ? (error as { errorCode: string }).errorCode.toLowerCase()
    : ''
  const rawMessage = typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : ''
  const message = rawMessage.trim().toLowerCase()
  const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined
  const mentionsToolProtocol = message.includes('tool') || message.includes('function call')
  const rejectsToolProtocol = /(?:not support|unsupported|unavailable|disabled|unknown|unrecognized|unexpected|not permitted|no endpoints? found)/.test(message)
  return errorCode === 'unsupported_model_input' || errorCode === 'unsupported_message_content'
    || message.includes('unsupported_model_input')
    || message.includes('unsupported_message_content')
    || message.includes('unsupported model input')
    || (statusCode === undefined || statusCode === 400 || statusCode === 404 || statusCode === 422)
      && mentionsToolProtocol
      && rejectsToolProtocol
}
