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

export const MAX_AUTOMD_OFFSET_SCAN_NODES = 20_000

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
  let scanned = 0
  const stack: Array<{ childCount: number; closingSize: number; index: number; node: Node }> = [{
    childCount: node.childCount,
    closingSize: 0,
    index: 0,
    node,
  }]

  while (stack.length > 0 && scanned < MAX_AUTOMD_OFFSET_SCAN_NODES) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.childCount) {
      offset += frame.closingSize
      stack.pop()
      continue
    }

    const child = frame.node.child(frame.index)
    frame.index += 1
    scanned += 1

    if (child.isText) {
      const index = child.text?.indexOf(placeholder) ?? -1
      if (index >= 0) {
        offset += index
        break
      }
      offset += child.nodeSize
      continue
    }

    if (child.childCount <= 0) {
      offset += child.nodeSize
      continue
    }

    offset += 1
    stack.push({
      childCount: child.childCount,
      closingSize: 1,
      index: 0,
      node: child,
    })
  }

  return offset
}
