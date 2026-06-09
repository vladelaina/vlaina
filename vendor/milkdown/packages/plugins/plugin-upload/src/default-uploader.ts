import type { Node } from '@milkdown/prose/model'

import { missingNodeInSchema } from '@milkdown/exception'

import type { Uploader } from './upload'

export const MAX_DEFAULT_UPLOAD_READ_CONCURRENCY = 4
export const MAX_DEFAULT_UPLOAD_FILES = 32
export const MAX_DEFAULT_UPLOAD_FILE_BYTES = 10 * 1024 * 1024

/// Read the image file as base64.
export function readImageAsBase64(
  file: File
): Promise<{ alt: string; src: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener(
      'load',
      () => {
        resolve({
          alt: file.name,
          src: reader.result as string,
        })
      },
      false
    )
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Failed to read image file')), false)
    reader.addEventListener('abort', () => reject(new Error('Image file read was aborted')), false)
    reader.readAsDataURL(file)
  })
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex
        nextIndex += 1
        results[index] = await mapper(items[index]!)
      }
    }
  )

  await Promise.all(workers)
  return results
}

/// The default uploader.
/// It will upload transform images to base64.
export const defaultUploader: Uploader = async (files, schema) => {
  const imgs: File[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files.item(i)
    if (!file) continue

    if (!file.type.includes('image')) continue
    if (file.size > MAX_DEFAULT_UPLOAD_FILE_BYTES) continue

    imgs.push(file)
    if (imgs.length >= MAX_DEFAULT_UPLOAD_FILES) break
  }

  const { image } = schema.nodes
  if (!image) throw missingNodeInSchema('image')

  const data = await mapWithConcurrencyLimit(
    imgs,
    MAX_DEFAULT_UPLOAD_READ_CONCURRENCY,
    async (img) => {
      try {
        return await readImageAsBase64(img)
      } catch {
        return null
      }
    }
  )

  return data
    .filter((item): item is { alt: string; src: string } => item !== null)
    .map(({ alt, src }) => image.createAndFill({ src, alt }) as Node)
}
