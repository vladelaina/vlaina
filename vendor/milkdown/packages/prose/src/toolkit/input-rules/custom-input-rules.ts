import type { InputRule } from '../../inputrules'
import type { EditorState, TextSelection, Transaction } from '../../state'
import type { EditorView } from '../../view'

import { Plugin, PluginKey } from '../../state'

const INPUT_RULE_COMPLETING_TEXT_PATTERN = /[\s\n`~～*＊_^$¥￥＄﹩=+\])）:]/u

export function textMayTriggerInputRule(text: string): boolean {
  return text === '' || INPUT_RULE_COMPLETING_TEXT_PATTERN.test(text)
}

const WHITESPACE_BLOCK_SHORTCUT_PATTERN =
  /^(?:\s*[>》]\s|\s*[-+*－＋＊]\s|\s*[0-9０-９]+[.．]\s|[#＃]+\s|(?:`{3,}|~{3,}|·{3,}|～{3,})[a-z0-9_-]*[\s\n]|(?:-{3,}|－{3,}|_{3,}|＿{3,}|\*{3,}|＊{3,})\s|[|｜][0-9０-９]+[xX×][0-9０-９]+[|｜]\s|(?:\[|【)(?:\s|x|X|✓)(?:\]|】)\s|(?:(?:[$¥￥＄﹩]){2}[^$¥￥＄﹩]+(?:[$¥￥＄﹩]){2}|\\\[[^\]]+\\\])\s)$/u
const CODE_FENCE_PREFIX_PATTERN = /^\s*(?:`{3,}|~{3,}|·{3,}|～{3,})/u
const INPUT_RULE_SPACE_PREFIX_BY_PREVIOUS_CHAR: [RegExp, RegExp][] = [
  [/^[>》]$/u, /^\s*[>》]/u],
  [/^[-+－＋]$/u, /^\s*[-+－＋]/u],
  [/^[*＊]$/u, /^\s*[*＊]/u],
  [/^[_＿]$/u, /^\s*[_＿]/u],
  [/^[.．]$/u, /^\s*[0-9０-９]/u],
  [/^[#＃]$/u, /^\s*[#＃]/u],
  [/^[|｜]$/u, /^\s*[|｜]/u],
  [/^[\]】]$/u, /^\s*(?:\[|【|\\\[)/u],
  [/^[$¥￥＄﹩]$/u, /^\s*(?:[$¥￥＄﹩]{2}|\\\[)/u],
  [/^[`~·～]$/u, CODE_FENCE_PREFIX_PATTERN],
  [/^[a-z0-9_-]$/iu, CODE_FENCE_PREFIX_PATTERN],
]

type TextBetweenParent = {
  textBetween: (
    from: number,
    to: number,
    blockSeparator?: string,
    leafText?: string
  ) => string
}

function getParentTextBefore(
  parent: TextBetweenParent,
  parentOffset: number,
  maxChars: number
): string {
  return parent.textBetween(
    Math.max(0, parentOffset - maxChars),
    parentOffset,
    undefined,
    '\uFFFC'
  )
}

function getParentTextPrefix(parent: TextBetweenParent, parentOffset: number): string {
  return parent.textBetween(0, Math.min(parentOffset, 8), undefined, '\uFFFC')
}

export function whitespaceMayCompleteInputRule(
  parent: TextBetweenParent,
  parentOffset: number
): boolean {
  if (parentOffset <= 0) return false

  const previousChar = getParentTextBefore(parent, parentOffset, 1)
  if (!previousChar || /\s/u.test(previousChar)) return false

  const prefix = getParentTextPrefix(parent, parentOffset)
  return INPUT_RULE_SPACE_PREFIX_BY_PREVIOUS_CHAR.some(
    ([previousPattern, prefixPattern]) =>
      previousPattern.test(previousChar) && prefixPattern.test(prefix)
  )
}

export function textBeforeMayTriggerInputRule(
  textBefore: string,
  text: string
): boolean {
  if (text === '') return true
  if (text.length !== 1) return true

  switch (text) {
    case ' ':
    case '\n':
      return WHITESPACE_BLOCK_SHORTCUT_PATTERN.test(textBefore)
    case '`':
      return /`[^`]+`$/u.test(textBefore)
    case '*':
    case '＊':
      return /(?:(?:^|[^*＊])[*＊][^*＊]+[*＊]|(?<![\w:/])(?:\*\*|＊＊)[^*_＊]+?(?:\*\*|＊＊)(?![\w/]))$/u.test(
        textBefore
      )
    case '_':
      return /(?:\b_(?![_\s]).*?[^_\s]_\b|(?<![\w:/])__[^*_＊]+?__(?![\w/])$)/u.test(
        textBefore
      )
    case '~':
    case '～':
      return /(?:(?:~|～)[^~～\s](?:[^~～]*[^~～\s])?(?:~|～)|(?:~|～){2}.+?(?:~|～){2})$/u.test(
        textBefore
      )
    case '^':
      return /(?<!\^)\^[^^]+\^$/u.test(textBefore)
    case '$':
    case '¥':
    case '￥':
    case '＄':
    case '﹩':
      return /(?<!\$)\$[^$\s](?:[^$]*[^$\s])?\$$/u.test(textBefore)
    case '=':
      return /(?<!=)==[^=]+==$/u.test(textBefore)
    case '+':
      return /(?<!\+)\+\+[^+]+\+\+$/u.test(textBefore)
    case ']':
      return /\[\^[^\]\n]+\]$/u.test(textBefore)
    case ')':
    case '）':
      return /(?:!|！)(?:\[|【).*?(?:\]|】)(?:\(|（)(?:<(?:\\.|[^>\n])+>|[^\s)）]+)(?:\s+(?:"|“)[^"”]+(?:"|”))?(?:\)|）)$/u.test(
        textBefore
      )
    case ':':
      return /:[^:\s]+:$/u.test(textBefore)
    default:
      return false
  }
}

function run(
  view: EditorView,
  from: number,
  to: number,
  text: string,
  rules: InputRule[],
  plugin: Plugin
) {
  if (view.composing) return false
  if (!textMayTriggerInputRule(text)) return false
  const state = view.state
  const $from = state.doc.resolve(from)
  if ($from.parent.type.spec.code) return false
  if (
    (text === ' ' || text === '\n') &&
    !whitespaceMayCompleteInputRule($from.parent, $from.parentOffset)
  ) {
    return false
  }
  const textBefore =
    getParentTextBefore($from.parent, $from.parentOffset, 500) + text
  if (!textBeforeMayTriggerInputRule(textBefore, text)) return false
  for (let _matcher of rules) {
    const matcher = _matcher as unknown as {
      match: RegExp
      handler: (
        state: EditorState,
        match: string[],
        from: number,
        to: number
      ) => Transaction
      undoable?: boolean
    }
    const match = matcher.match.exec(textBefore)
    const tr =
      match &&
      match[0] &&
      matcher.handler(state, match, from - (match[0].length - text.length), to)
    if (!tr) continue
    if (matcher.undoable !== false)
      tr.setMeta(plugin, { transform: tr, from, to, text })
    view.dispatch(tr)
    return true
  }
  return false
}

export const customInputRulesKey = new PluginKey('MILKDOWN_CUSTOM_INPUTRULES')
export function customInputRules({ rules }: { rules: InputRule[] }): Plugin {
  const plugin: Plugin = new Plugin({
    key: customInputRulesKey,
    isInputRules: true,

    state: {
      init() {
        return null
      },
      apply(this: typeof plugin, tr, prev) {
        const stored = tr.getMeta(this)
        if (stored) return stored
        return tr.selectionSet || tr.docChanged ? null : prev
      },
    },
    props: {
      handleTextInput(view, from, to, text) {
        return run(view, from, to, text, rules, plugin)
      },
      handleDOMEvents: {
        compositionend: (view) => {
          setTimeout(() => {
            const { $cursor } = view.state.selection as TextSelection
            if ($cursor) run(view, $cursor.pos, $cursor.pos, '', rules, plugin)
          })
          return false
        },
      },
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') return false
        const { $cursor } = view.state.selection as TextSelection
        if ($cursor)
          return run(view, $cursor.pos, $cursor.pos, '\n', rules, plugin)
        return false
      },
    },
  })
  return plugin
}
