import type { Ctx } from '@milkdown/ctx'
import type { Node } from '@milkdown/prose/model'
import type { EditorState } from '@milkdown/prose/state'

import { parserCtx, serializerCtx } from '@milkdown/core'
import { pipe } from '@milkdown/utils'

import { inlineSyncConfig } from './config'
import { asterisk, asteriskHolder, underline, underlineHolder } from './regexp'
import {
  calculatePlaceholder,
  keepLink,
  mergeSlash,
  replacePunctuation,
} from './utils'

interface InlineSyncContext {
  text: string
  prevNode: Node
  nextNode: Node
  placeholder: string
}

export const MAX_AUTOMD_GLOBAL_NODE_SCAN_NODES = 20_000
export const MAX_AUTOMD_GLOBAL_NODES = 1_000
export const MAX_AUTOMD_GENERATED_NODE_SCAN_NODES = 20_000

function getNodeFromSelection(state: EditorState) {
  return state.selection.$from.node()
}

function getMarkdown(
  ctx: Ctx,
  state: EditorState,
  node: Node,
  globalNode: Node[]
) {
  const serializer = ctx.get(serializerCtx)
  const doc = state.schema.topNodeType.create(undefined, [node, ...globalNode])

  return serializer(doc)
}

export function splitFirstMarkdownBlock(markdown: string) {
  const separatorIndex = markdown.indexOf('\n\n')
  if (separatorIndex < 0)
    return { firstBlock: markdown, rest: '' }

  return {
    firstBlock: markdown.slice(0, separatorIndex),
    rest: markdown.slice(separatorIndex),
  }
}

function addPlaceholder(ctx: Ctx, markdown: string) {
  const config = ctx.get(inlineSyncConfig.key)
  const holePlaceholder = config.placeholderConfig.hole

  const { firstBlock, rest } = splitFirstMarkdownBlock(markdown)

  const movePlaceholder = (text: string) =>
    config.movePlaceholder(holePlaceholder, text)

  const handleText = pipe(
    replacePunctuation(holePlaceholder),
    movePlaceholder,
    keepLink,
    mergeSlash
  )

  let text = handleText(firstBlock)
  const placeholder = calculatePlaceholder(config.placeholderConfig)(text)

  text = text.replace(holePlaceholder, placeholder)

  text = `${text}${rest}`

  return [text, placeholder] as [markdown: string, placeholder: string]
}

function getNewNode(ctx: Ctx, text: string) {
  const parser = ctx.get(parserCtx)
  const parsed = parser(text)

  if (!parsed) return null

  return parsed.firstChild
}

function getNodeChildCount(node: Node): number {
  return typeof node.childCount === 'number' && Number.isFinite(node.childCount) && node.childCount > 0
    ? Math.floor(node.childCount)
    : 0
}

function isGlobalNode(node: Node, globalNodes: Array<Node['type'] | string>) {
  return globalNodes.includes(node.type.name) || globalNodes.includes(node.type)
}

export function collectAutomdGlobalNodes(
  doc: Node,
  globalNodes: Array<Node['type'] | string>,
  maxScanNodes = MAX_AUTOMD_GLOBAL_NODE_SCAN_NODES,
  maxMatches = MAX_AUTOMD_GLOBAL_NODES
) {
  const nodes: Node[] = []
  let scanned = 0
  const stack: Array<{ childCount: number; index: number; node: Node }> = [{
    childCount: getNodeChildCount(doc),
    index: 0,
    node: doc,
  }]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.childCount) {
      stack.pop()
      continue
    }

    if (scanned >= maxScanNodes || nodes.length >= maxMatches)
      return { complete: false, nodes }

    const node = frame.node.child(frame.index)
    frame.index += 1
    scanned += 1

    if (isGlobalNode(node, globalNodes)) {
      nodes.push(node)
      continue
    }

    const childCount = getNodeChildCount(node)
    if (childCount > 0)
      stack.push({ childCount, index: 0, node })
  }

  return { complete: true, nodes }
}

function collectGlobalNodes(ctx: Ctx, state: EditorState) {
  const { globalNodes } = ctx.get(inlineSyncConfig.key)
  return collectAutomdGlobalNodes(state.doc, globalNodes)
}

const removeGlobalFromText = (text: string) =>
  splitFirstMarkdownBlock(text).firstBlock

function onlyHTML(node: Node) {
  return node.childCount === 1 && node.child(0).type.name === 'html'
}

export function normalizeAutomdGeneratedNode(
  root: Node,
  placeholder: string,
  maxScanNodes = MAX_AUTOMD_GENERATED_NODE_SCAN_NODES
) {
  let scanned = 0
  const stack: Array<{ childCount: number; index: number; node: Node }> = [{
    childCount: getNodeChildCount(root),
    index: 0,
    node: root,
  }]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.childCount) {
      stack.pop()
      continue
    }

    if (scanned >= maxScanNodes)
      return false

    const node = frame.node.child(frame.index)
    frame.index += 1
    scanned += 1

    const marks = node.marks
    const link = marks.find((mark) => mark.type.name === 'link')
    if (
      link &&
      node.text?.includes(placeholder) &&
      link.attrs.href.includes(placeholder)
    ) {
      // @ts-expect-error hijack the mark attribute
      link.attrs.href = link.attrs.href.replace(placeholder, '')
    }
    if (
      node.text?.includes(asteriskHolder) ||
      node.text?.includes(underlineHolder)
    ) {
      // @ts-expect-error hijack the attribute
      node.text = node.text
        .replaceAll(asteriskHolder, asterisk)
        .replaceAll(underlineHolder, underline)
    }

    const childCount = getNodeChildCount(node)
    if (childCount > 0)
      stack.push({ childCount, index: 0, node })
  }

  return true
}

export function getContextByState(
  ctx: Ctx,
  state: EditorState
): InlineSyncContext | null {
  try {
    const globalNodeResult = collectGlobalNodes(ctx, state)
    if (!globalNodeResult.complete) return null

    const globalNode = globalNodeResult.nodes
    const node = getNodeFromSelection(state)

    const markdown = getMarkdown(ctx, state, node, globalNode)
    const [text, placeholder] = addPlaceholder(ctx, markdown)

    const newNode = getNewNode(ctx, text)

    if (!newNode || node.type !== newNode.type || onlyHTML(newNode)) return null

    // @ts-expect-error hijack the node attribute
    newNode.attrs = { ...node.attrs }

    if (!normalizeAutomdGeneratedNode(newNode, placeholder)) return null

    return {
      text: removeGlobalFromText(text),
      prevNode: node,
      nextNode: newNode,
      placeholder,
    }
  } catch {
    return null
  }
}
