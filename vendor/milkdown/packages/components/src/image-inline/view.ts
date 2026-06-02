import type { Node } from '@milkdown/prose/model'
import type { NodeViewConstructor } from '@milkdown/prose/view'

import { imageSchema, sanitizeImageSrc } from '@milkdown/preset-commonmark'
import { $view } from '@milkdown/utils'
import { createApp, ref, watchEffect } from 'vue'

import { withMeta } from '../__internal__/meta'
import { MilkdownImageInline } from './components/image-inline'
import { inlineImageConfig } from './config'

export const inlineImageView = $view(
  imageSchema.node,
  (ctx): NodeViewConstructor => {
    return (initialNode, view, getPos) => {
      const src = ref(
        sanitizeImageSrc(initialNode.attrs.src, { allowEmpty: true }) ?? ''
      )
      const alt = ref(initialNode.attrs.alt)
      const title = ref(initialNode.attrs.title)
      const selected = ref(false)
      const readonly = ref(!view.editable)
      const setAttr = (attr: string, value: unknown) => {
        if (!view.editable) return
        const pos = getPos()
        if (pos == null) return
        if (attr === 'src') {
          const src = sanitizeImageSrc(value, { allowEmpty: true })
          if (src == null) return
          view.dispatch(view.state.tr.setNodeAttribute(pos, attr, src))
          return
        }
        view.dispatch(view.state.tr.setNodeAttribute(pos, attr, value))
      }

      const config = ctx.get(inlineImageConfig.key)
      const app = createApp(MilkdownImageInline, {
        src,
        alt,
        title,
        selected,
        readonly,
        setAttr,
        config,
      })
      const dom = document.createElement('span')
      dom.className = 'milkdown-image-inline'
      const disposeSelectedWatcher = watchEffect(() => {
        const isSelected = selected.value
        if (isSelected) {
          dom.classList.add('selected')
        } else {
          dom.classList.remove('selected')
        }
      })
      const proxyDomURL = config.proxyDomURL
      const bindAttrs = (node: Node) => {
        const safeSrc =
          sanitizeImageSrc(node.attrs.src, { allowEmpty: true }) ?? ''
        if (!proxyDomURL || !safeSrc) {
          src.value = safeSrc
        } else {
          const proxiedURL = proxyDomURL(safeSrc)
          if (typeof proxiedURL === 'string') {
            src.value = sanitizeImageSrc(proxiedURL, { allowEmpty: true }) ?? ''
          } else {
            proxiedURL
              .then((url) => {
                src.value = sanitizeImageSrc(url, { allowEmpty: true }) ?? ''
              })
              .catch(console.error)
          }
        }
        alt.value = node.attrs.alt
        title.value = node.attrs.title
      }
      bindAttrs(initialNode)
      app.mount(dom)

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type !== initialNode.type) return false

          bindAttrs(updatedNode)
          return true
        },
        stopEvent: (e) => {
          if (e.target instanceof HTMLInputElement) return true

          return false
        },
        selectNode: () => {
          selected.value = true
        },
        deselectNode: () => {
          selected.value = false
        },
        destroy: () => {
          disposeSelectedWatcher()
          app.unmount()
          dom.remove()
        },
      }
    }
  }
)

withMeta(inlineImageView, {
  displayName: 'NodeView<image-inline>',
  group: 'ImageInline',
})
