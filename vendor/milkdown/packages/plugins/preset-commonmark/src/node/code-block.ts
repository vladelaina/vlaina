import { commandsCtx } from '@milkdown/core'
import { expectDomTypeError } from '@milkdown/exception'
import { setBlockType } from '@milkdown/prose/commands'
import { textblockTypeInputRule } from '@milkdown/prose/inputrules'
import {
  $command,
  $inputRule,
  $nodeAttr,
  $nodeSchema,
  $useKeymap,
} from '@milkdown/utils'

import { withMeta } from '../__internal__'

export const MAX_CODE_BLOCK_LANGUAGE_CHARS = 64
const codeBlockLanguagePattern = /^[A-Za-z0-9_.#+-]+$/

export function normalizeCodeBlockLanguageAttr(value: unknown) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  if (
    !normalized
    || normalized.length > MAX_CODE_BLOCK_LANGUAGE_CHARS
    || !codeBlockLanguagePattern.test(normalized)
  ) {
    return ''
  }
  return normalized
}

/// HTML attributes for code block node.
export const codeBlockAttr = $nodeAttr('codeBlock', () => ({
  pre: {},
  code: {},
}))

withMeta(codeBlockAttr, {
  displayName: 'Attr<codeBlock>',
  group: 'CodeBlock',
})

/// Schema for code block node.
export const codeBlockSchema = $nodeSchema('code_block', (ctx) => {
  return {
    content: 'text*',
    group: 'block',
    marks: '',
    defining: true,
    code: true,
    attrs: {
      language: {
        default: '',
        validate: 'string',
      },
    },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)

          return { language: normalizeCodeBlockLanguageAttr(dom.dataset.language) }
        },
      },
    ],
    toDOM: (node) => {
      const attr = ctx.get(codeBlockAttr.key)(node)
      const language = normalizeCodeBlockLanguageAttr(node.attrs.language)
      const languageAttrs =
        language && language.length > 0
          ? { 'data-language': language }
          : undefined

      return [
        'pre',
        {
          ...attr.pre,
          ...languageAttrs,
        },
        ['code', attr.code, 0],
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'code',
      runner: (state, node, type) => {
        const language = normalizeCodeBlockLanguageAttr(node.lang)
        const value = node.value as string | null
        state.openNode(type, { language })
        if (value) state.addText(value)

        state.closeNode()
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'code_block',
      runner: (state, node) => {
        state.addNode('code', undefined, node.content.firstChild?.text || '', {
          lang: normalizeCodeBlockLanguageAttr(node.attrs.language),
        })
      },
    },
  }
})

withMeta(codeBlockSchema.node, {
  displayName: 'NodeSchema<codeBlock>',
  group: 'CodeBlock',
})

withMeta(codeBlockSchema.ctx, {
  displayName: 'NodeSchemaCtx<codeBlock>',
  group: 'CodeBlock',
})

/// A input rule for creating code block.
/// For example, ` ```javascript ` will create a code block with language javascript.
export const createCodeBlockInputRule = $inputRule((ctx) =>
  textblockTypeInputRule(
    /^(?:`{3,}|~{3,}|·{3,}|～{3,})(?<language>[a-z0-9_-]*)?[\s\n]$/,
    codeBlockSchema.type(ctx),
    (match) => ({
      language: normalizeCodeBlockLanguageAttr(match.groups?.language),
    })
  )
)

withMeta(createCodeBlockInputRule, {
  displayName: 'InputRule<createCodeBlockInputRule>',
  group: 'CodeBlock',
})

/// A command for creating code block.
/// You can pass the language of the code block as the parameter.
export const createCodeBlockCommand = $command(
  'CreateCodeBlock',
  (ctx) =>
    (language = '') =>
      setBlockType(codeBlockSchema.type(ctx), {
        language: normalizeCodeBlockLanguageAttr(language),
      })
)

withMeta(createCodeBlockCommand, {
  displayName: 'Command<createCodeBlockCommand>',
  group: 'CodeBlock',
})

/// A command for updating the code block language of the target position.
export const updateCodeBlockLanguageCommand = $command(
  'UpdateCodeBlockLanguage',
  () =>
    (
      { pos, language }: { pos: number; language: string } = {
        pos: -1,
        language: '',
      }
    ) =>
    (state, dispatch) => {
      if (pos >= 0) {
        dispatch?.(state.tr.setNodeAttribute(pos, 'language', normalizeCodeBlockLanguageAttr(language)))
        return true
      }

      return false
    }
)

withMeta(updateCodeBlockLanguageCommand, {
  displayName: 'Command<updateCodeBlockLanguageCommand>',
  group: 'CodeBlock',
})

/// Keymap for code block.
/// - `Mod-Alt-c`: Create a code block.
export const codeBlockKeymap = $useKeymap('codeBlockKeymap', {
  CreateCodeBlock: {
    shortcuts: 'Mod-Alt-c',
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)
      return () => commands.call(createCodeBlockCommand.key)
    },
  },
})

withMeta(codeBlockKeymap.ctx, {
  displayName: 'KeymapCtx<codeBlock>',
  group: 'CodeBlock',
})

withMeta(codeBlockKeymap.shortcuts, {
  displayName: 'Keymap<codeBlock>',
  group: 'CodeBlock',
})
