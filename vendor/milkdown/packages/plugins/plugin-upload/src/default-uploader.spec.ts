import { describe, expect, it, vi } from 'vitest'

import {
  MAX_DEFAULT_UPLOAD_READ_CONCURRENCY,
  MAX_DEFAULT_UPLOAD_FILE_BYTES,
  MAX_DEFAULT_UPLOAD_FILES,
  defaultUploader,
} from './default-uploader'

type Listener = () => void

function createFileList(files: readonly File[]): FileList {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as FileList
}

function createSchema() {
  return {
    nodes: {
      image: {
        createAndFill: (attrs: { src: string; alt: string }) => ({
          type: 'image',
          attrs,
        }),
      },
    },
  } as never
}

describe('defaultUploader', () => {
  it('limits concurrent base64 reads while preserving image order', async () => {
    const OriginalFileReader = globalThis.FileReader
    let activeReads = 0
    let maxActiveReads = 0

    class MockFileReader {
      result: string | ArrayBuffer | null = null
      private listeners = new Map<string, Listener[]>()

      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
      }

      readAsDataURL(file: File) {
        activeReads += 1
        maxActiveReads = Math.max(maxActiveReads, activeReads)
        setTimeout(() => {
          this.result = `data:image/png;base64,${file.name}`
          activeReads -= 1
          for (const listener of this.listeners.get('load') ?? []) {
            listener()
          }
        }, 0)
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)
    try {
      const files = Array.from({ length: 12 }, (_value, index) =>
        new File(['x'], `image-${index}.png`, { type: 'image/png' })
      )

      const nodes = await defaultUploader(createFileList(files), createSchema())

      expect(maxActiveReads).toBeLessThanOrEqual(MAX_DEFAULT_UPLOAD_READ_CONCURRENCY)
      expect(nodes.map((node) => node.attrs.alt)).toEqual(files.map((file) => file.name))
    } finally {
      vi.stubGlobal('FileReader', OriginalFileReader)
    }
  })

  it('skips images that fail to read', async () => {
    const OriginalFileReader = globalThis.FileReader

    class MockFileReader {
      result: string | ArrayBuffer | null = null
      error: DOMException | null = null
      private listeners = new Map<string, Listener[]>()

      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
      }

      readAsDataURL(file: File) {
        setTimeout(() => {
          if (file.name.includes('broken')) {
            this.error = new DOMException('broken image')
            for (const listener of this.listeners.get('error') ?? []) {
              listener()
            }
            return
          }

          this.result = `data:image/png;base64,${file.name}`
          for (const listener of this.listeners.get('load') ?? []) {
            listener()
          }
        }, 0)
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)
    try {
      const nodes = await defaultUploader(
        createFileList([
          new File(['x'], 'good-1.png', { type: 'image/png' }),
          new File(['x'], 'broken.png', { type: 'image/png' }),
          new File(['x'], 'good-2.png', { type: 'image/png' }),
        ]),
        createSchema()
      )

      expect(nodes.map((node) => node.attrs.alt)).toEqual(['good-1.png', 'good-2.png'])
    } finally {
      vi.stubGlobal('FileReader', OriginalFileReader)
    }
  })

  it('limits default upload file count and skips oversized images before reading', async () => {
    const OriginalFileReader = globalThis.FileReader
    const readNames: string[] = []

    class MockFileReader {
      result: string | ArrayBuffer | null = null
      private listeners = new Map<string, Listener[]>()

      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
      }

      readAsDataURL(file: File) {
        readNames.push(file.name)
        this.result = `data:image/png;base64,${file.name}`
        for (const listener of this.listeners.get('load') ?? []) {
          listener()
        }
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)
    try {
      const oversized = new File(['x'], 'huge.png', { type: 'image/png' })
      Object.defineProperty(oversized, 'size', { value: MAX_DEFAULT_UPLOAD_FILE_BYTES + 1 })
      const files = [
        oversized,
        ...Array.from({ length: MAX_DEFAULT_UPLOAD_FILES + 4 }, (_value, index) =>
          new File(['x'], `image-${index}.png`, { type: 'image/png' })
        ),
      ]

      const nodes = await defaultUploader(createFileList(files), createSchema())

      expect(readNames).toHaveLength(MAX_DEFAULT_UPLOAD_FILES)
      expect(readNames).not.toContain('huge.png')
      expect(nodes.map((node) => node.attrs.alt)).toEqual(readNames)
    } finally {
      vi.stubGlobal('FileReader', OriginalFileReader)
    }
  })
})
