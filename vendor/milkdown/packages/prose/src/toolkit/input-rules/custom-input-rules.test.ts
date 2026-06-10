import { describe, expect, it } from 'vitest'

import {
  textBeforeMayTriggerInputRule,
  textMayTriggerInputRule,
  whitespaceMayCompleteInputRule,
} from './custom-input-rules'

function createParentText(text: string) {
  return {
    textBetween: (from: number, to: number) => text.slice(from, to),
  }
}

describe('textMayTriggerInputRule', () => {
  it('skips ordinary text that cannot complete markdown input rules', () => {
    expect(textMayTriggerInputRule('a')).toBe(false)
    expect(textMayTriggerInputRule('中')).toBe(false)
    expect(textMayTriggerInputRule('7')).toBe(false)
  })

  it('keeps rule-completing delimiters, whitespace, and composition flushes on the input-rule path', () => {
    for (const text of ['', ' ', '\n', '*', '_', '`', '~', '$', ']', ')', ':']) {
      expect(textMayTriggerInputRule(text)).toBe(true)
    }
  })

  it('skips delimiter characters that cannot complete an input rule by themselves', () => {
    for (const text of ['|', '#', '>', '<', '-', '.', '!', '(', '[']) {
      expect(textMayTriggerInputRule(text)).toBe(false)
    }
  })
})

describe('textBeforeMayTriggerInputRule', () => {
  it('skips ordinary whitespace inside prose and markdown table rows', () => {
    expect(textBeforeMayTriggerInputRule('| 功能            ', ' ')).toBe(false)
    expect(textBeforeMayTriggerInputRule('显示/隐藏侧边栏 ', ' ')).toBe(false)
    expect(textBeforeMayTriggerInputRule('Ctrl+Shift+L ', ' ')).toBe(false)
  })

  it('keeps block shortcuts on the input-rule path', () => {
    for (const [textBefore, text] of [
      ['# ', ' '],
      ['### ', ' '],
      ['- ', ' '],
      ['1. ', ' '],
      ['> ', ' '],
      ['```ts ', ' '],
      ['--- ', ' '],
      ['|2x2| ', ' '],
      ['[ ] ', ' '],
      ['$$x+1$$ ', ' '],
      ['\\[x+1\\] ', ' '],
    ] as const) {
      expect(textBeforeMayTriggerInputRule(textBefore, text)).toBe(true)
    }
  })

  it('keeps inline mark and atomic shortcuts on the input-rule path', () => {
    for (const [textBefore, text] of [
      ['**bold**', '*'],
      ['__bold__', '_'],
      ['*em*', '*'],
      ['_em_', '_'],
      ['`code`', '`'],
      ['~~strike~~', '~'],
      ['==highlight==', '='],
      ['++under++', '+'],
      ['^sup^', '^'],
      ['~sub~', '~'],
      ['$x+1$', '$'],
      ['word[^1]', ']'],
      ['![alt](image.png)', ')'],
      [':smile:', ':'],
    ] as const) {
      expect(textBeforeMayTriggerInputRule(textBefore, text)).toBe(true)
    }
  })
})

describe('whitespaceMayCompleteInputRule', () => {
  it('skips prose and markdown table padding spaces before reading long lookback text', () => {
    expect(whitespaceMayCompleteInputRule(createParentText('| 功能           '), 16)).toBe(false)
    expect(whitespaceMayCompleteInputRule(createParentText('显示/隐藏侧边栏'), 7)).toBe(false)
    expect(whitespaceMayCompleteInputRule(createParentText('Ctrl+Shift+L'), 12)).toBe(false)
  })

  it('keeps whitespace that can finish block input rules', () => {
    for (const text of [
      '#',
      '###',
      '-',
      '1.',
      '>',
      '```ts',
      '---',
      '|2x2|',
      '[ ]',
      '$$x+1$$',
      '\\[x+1\\]',
    ]) {
      expect(whitespaceMayCompleteInputRule(createParentText(text), text.length)).toBe(true)
    }
  })
})
