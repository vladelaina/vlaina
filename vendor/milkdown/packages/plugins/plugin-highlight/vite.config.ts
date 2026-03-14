import { pluginViteConfig } from '../../vite'

export default pluginViteConfig(import.meta.url, {
  external: [/prosemirror/],
})
