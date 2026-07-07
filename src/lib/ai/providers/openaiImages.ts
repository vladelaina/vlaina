import type { ChatMessageContent } from '../types'
import { getBase64DecodedByteLength, MAX_INLINE_IMAGE_BYTES, normalizeSafeRasterDataImageSrc } from '@/lib/markdown/dataImagePolicy'
import { escapeMarkdownAngleDestination, formatMarkdownImage } from '@/lib/markdown/markdownImageMarkdown'
import { normalizeRenderableImageSrc } from '@/lib/markdown/renderableImagePolicy'
import { toBlobParts } from '@/lib/blobPart'

export function getFirstImageInput(content: ChatMessageContent): string | null {
  if (!Array.isArray(content)) return null
  const imagePart = content.find((part) => part.type === 'image_url')
  return imagePart?.type === 'image_url' ? imagePart.image_url.url.trim() || null : null
}

function normalizeProviderImageUrl(value: string): string | null {
  const url = normalizeRenderableImageSrc(value)
  if (!url) return null

  const normalized = url.toLowerCase()
  return normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:')
    ? url
    : null
}

function parseDataImageUrl(value: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(value.trim())
  if (!match) return null

  const byteLength = getBase64DecodedByteLength(match[2])
  if (byteLength === null || byteLength > MAX_INLINE_IMAGE_BYTES) return null

  const binary = atob(match[2])
  if (binary.length > MAX_INLINE_IMAGE_BYTES) return null
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return { bytes, mimeType: match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase() }
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

function escapeMultipartValue(value: string): string {
  return value.replace(/"/g, '%22').replace(/\r|\n/g, ' ')
}

export function buildImageEditMultipartBody({
  model,
  prompt,
  imageUrl,
}: {
  imageUrl: string
  model: string
  prompt: string
}): { body: Blob; headers: Record<string, string> } {
  const parsedImage = parseDataImageUrl(imageUrl)
  if (!parsedImage) {
    throw new Error('Image edits require a PNG, JPEG, or WebP image attachment.')
  }

  const boundary = `----image-edit-${crypto.randomUUID()}`
  const chunks: Array<string | Uint8Array> = []
  const appendField = (name: string, value: string) => {
    chunks.push(
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${escapeMultipartValue(name)}"\r\n\r\n`,
      value,
      '\r\n',
    )
  }
  const appendFile = (name: string, filename: string, mimeType: string, bytes: Uint8Array) => {
    chunks.push(
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${escapeMultipartValue(name)}"; filename="${escapeMultipartValue(filename)}"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
      bytes,
      '\r\n',
    )
  }

  appendField('model', model)
  appendField('prompt', prompt)
  appendField('n', '1')
  appendFile('image', `image.${extensionForMimeType(parsedImage.mimeType)}`, parsedImage.mimeType, parsedImage.bytes)
  chunks.push(`--${boundary}--\r\n`)

  return {
    body: new Blob(toBlobParts(chunks)),
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  }
}

function normalizeGeneratedImageAlt(value: unknown, index: number): string {
  const fallback = `Generated image ${index + 1}`
  if (typeof value !== 'string') return fallback

  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)

  return normalized || fallback
}

function normalizeGeneratedImageUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  return normalizeProviderImageUrl(value) ?? ''
}

function normalizeGeneratedImageBase64(value: unknown): string {
  if (typeof value !== 'string') return ''
  return normalizeSafeRasterDataImageSrc(`data:image/png;base64,${value.trim()}`) ?? ''
}

export function normalizeGeneratedImageMarkdown(payload: Record<string, unknown>): string {
  const data = Array.isArray(payload.data) ? payload.data : []
  const markdown = data.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const url = normalizeGeneratedImageUrl(record.url) || normalizeGeneratedImageBase64(record.b64_json)
    const destination = escapeMarkdownAngleDestination(url, { stripWhitespace: true })
    return destination
      ? [formatMarkdownImage(destination, normalizeGeneratedImageAlt(record.revised_prompt, index))]
      : []
  })

  return markdown.join('\n\n')
}
