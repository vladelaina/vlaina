import clsx from 'clsx'
import DOMPurify from 'dompurify'
import { h } from 'vue'

h

type IconProps = {
  icon?: string | null
  class?: string
  onClick?: (event: PointerEvent) => void
}

const maxIconMarkupChars = 64 * 1024

export function sanitizeIconMarkup(icon: string) {
  const trimmed = icon.trim()
  if (trimmed.length > maxIconMarkupChars)
    return ''

  return DOMPurify.sanitize(trimmed)
}

export function Icon({ icon, class: className, onClick }: IconProps) {
  return (
    <span
      class={clsx('milkdown-icon', className)}
      onPointerdown={onClick}
      ref={(el) => {
        if (el && icon) {
          ;(el as HTMLElement).innerHTML = sanitizeIconMarkup(icon)
        }
      }}
    />
  )
}

Icon.props = {
  icon: {
    type: String,
    required: false,
  },
  class: {
    type: String,
    required: false,
  },
  onClick: {
    type: Function,
    required: false,
  },
}
