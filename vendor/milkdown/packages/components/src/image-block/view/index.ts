import type { Node } from '@milkdown/prose/model'
import type { NodeViewConstructor } from '@milkdown/prose/view'

import { sanitizeImageSrc } from '@milkdown/preset-commonmark'
import { $view } from '@milkdown/utils'
import { createApp, ref, watchEffect } from 'vue'

import { withMeta } from '../../__internal__/meta'
import { imageBlockConfig } from '../config'
import { imageBlockSchema } from '../schema'
import { MilkdownImageBlock } from './components/image-block'

export const imageBlockView = $view(
  imageBlockSchema.node,
  (ctx): NodeViewConstructor => {
    return (initialNode, view, getPos) => {
      const src = ref(
        sanitizeImageSrc(initialNode.attrs.src, { allowEmpty: true }) ?? ''
      )
      const caption = ref(initialNode.attrs.caption)
      const ratio = ref(initialNode.attrs.ratio)
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
      const config = ctx.get(imageBlockConfig.key)
      const app = createApp(MilkdownImageBlock, {
        src,
        caption,
        ratio,
        selected,
        readonly,
        setAttr,
        config,
      })
      const dom = document.createElement('div')
      dom.className = 'milkdown-image-block'
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
        ratio.value = node.attrs.ratio
        caption.value = node.attrs.caption

        readonly.value = !view.editable
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

withMeta(imageBlockView, {
  displayName: 'NodeView<image-block>',
  group: 'ImageBlock',
})
