import DOMPurify from 'dompurify'
import { defineComponent, ref, watchEffect, type Ref, h, Fragment } from 'vue'

import type { CodeBlockProps } from './code-block'

h
Fragment

type PreviewPanelProps = Pick<
  CodeBlockProps,
  'text' | 'language' | 'config'
> & {
  previewOnlyMode: Ref<boolean>
  preview: Ref<string | HTMLElement | null>
}

const maxPreviewHtmlChars = 2 * 1024 * 1024
export const maxPreviewHtmlNodes = 20_000
export const maxPreviewHtmlDepth = 128

function isPreviewDomWithinBudget(root: Node, initialDepth = 1) {
  const stack: Array<{ node: Node; depth: number }> = [{ node: root, depth: initialDepth }]
  let visitedNodes = 0

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!
    visitedNodes += 1
    if (visitedNodes > maxPreviewHtmlNodes || depth > maxPreviewHtmlDepth)
      return false

    for (let child = node.lastChild; child; child = child.previousSibling)
      stack.push({ node: child, depth: depth + 1 })
  }

  return true
}

export function isPreviewHtmlWithinDomBudget(html: string) {
  if (html.length > maxPreviewHtmlChars)
    return false

  const template = document.createElement('template')
  template.innerHTML = html
  const isWithinBudget = isPreviewDomWithinBudget(template.content, 0)
  template.remove()
  return isWithinBudget
}

export function sanitizePreviewContent(previewContent: string | HTMLElement) {
  if (
    typeof previewContent === 'string' &&
    !isPreviewHtmlWithinDomBudget(previewContent)
  ) {
    return ''
  }

  if (
    previewContent instanceof Element &&
    !isPreviewDomWithinBudget(previewContent)
  ) {
    return ''
  }

  const html = typeof previewContent === 'string'
    ? previewContent
    : previewContent.outerHTML

  if (html.length > maxPreviewHtmlChars)
    return ''

  return DOMPurify.sanitize(html)
}

export const PreviewPanel = defineComponent<PreviewPanelProps>({
  props: {
    text: {
      type: Object,
      required: true,
    },
    language: {
      type: Object,
      required: true,
    },
    config: {
      type: Object,
      required: true,
    },
    previewOnlyMode: {
      type: Object,
      required: true,
    },
    preview: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const { previewOnlyMode, config, preview } = props
    const previewRef = ref<HTMLDivElement>()

    watchEffect(() => {
      const previewContainer = previewRef.value
      if (!previewContainer) return

      while (previewContainer.firstChild) {
        previewContainer.removeChild(previewContainer.firstChild)
      }

      const previewContent = preview.value

      if (
        typeof previewContent === 'string' ||
        previewContent instanceof Element
      ) {
        previewContainer.innerHTML = sanitizePreviewContent(previewContent)
      }
    })

    return () => {
      if (!preview.value) return null

      return (
        <div class="preview-panel">
          {!previewOnlyMode.value && (
            <>
              <div class="preview-divider" />
              <div class="preview-label">{config.previewLabel}</div>
            </>
          )}
          <div ref={previewRef} class="preview" />
        </div>
      )
    }
  },
})
