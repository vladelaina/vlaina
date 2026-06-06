import type { Node } from '@milkdown/prose/model'

import type { SyncNodePlaceholder } from './config'

import {
  asterisk,
  asteriskHolder,
  keepLinkRegexp,
  punctuationRegexp,
  underline,
  underlineHolder,
} from './regexp'

export function keepLink(str: string) {
  let text = str
  let match = text.match(keepLinkRegexp)
  while (match && match.groups) {
    const { span } = match.groups
    text = text.replace(keepLinkRegexp, span as string)

    match = text.match(keepLinkRegexp)
  }
  return text
}

export function mergeSlash(str: string) {
  return str
    .replaceAll(/\\\\\*/g, asterisk)
    .replaceAll(/\\\\_/g, underline)
    .replaceAll(asterisk, asteriskHolder)
    .replaceAll(underline, underlineHolder)
}

export function swap(text: string, first: number, last: number) {
  const firstChar = text.charAt(first)
  const lastChar = text.charAt(last)
  if (!firstChar || !lastChar || first === last) return text

  const lower = Math.min(first, last)
  const upper = Math.max(first, last)
  const lowerChar = text.charAt(lower)
  const upperChar = text.charAt(upper)

  return `${text.slice(0, lower)}${upperChar}${text.slice(
    lower + 1,
    upper
  )}${lowerChar}${text.slice(upper + 1)}`
}

export function replacePunctuation(holePlaceholder: string) {
  return (text: string) => text.replace(punctuationRegexp(holePlaceholder), '')
}

export function calculatePlaceholder(placeholder: SyncNodePlaceholder) {
  return (text: string) => {
    const index = text.indexOf(placeholder.hole)
    const left = text.charAt(index - 1)
    const right = text.charAt(index + 1)
    const notAWord = /[^\w]|_/

    // cursor on the right
    if (!right) return placeholder.punctuation

    // cursor on the left
    if (!left) return placeholder.char

    if (notAWord.test(left) && notAWord.test(right))
      return placeholder.punctuation

    return placeholder.char
  }
}

export function calcOffset(node: Node, from: number, placeholder: string) {
  let offset = from

  const scan = (current: Node): boolean => {
    for (let index = 0; index < current.childCount; index++) {
      const n = current.child(index)
      if (!n.textContent.includes(placeholder)) {
        offset += n.nodeSize
        continue
      }
      if (n.isText) {
        const i = n.text?.indexOf(placeholder)
        if (i != null && i >= 0) {
          offset += i
          return true
        }
      }

      // enter the node
      offset += 1
      if (scan(n)) return true
      offset += n.nodeSize
    }

    return false
  }

  scan(node)
  return offset
}
