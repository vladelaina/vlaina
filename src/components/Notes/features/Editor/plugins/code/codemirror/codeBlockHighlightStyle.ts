import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { themeFontWeightTokens } from '@/styles/themeTokens';

const githubSyntax = {
  foreground: 'var(--vlaina-markdown-color-code-text)',
  muted: 'var(--vlaina-markdown-color-code-muted)',
  keyword: 'var(--vlaina-markdown-color-code-keyword)',
  name: 'var(--vlaina-markdown-color-code-name)',
  function: 'var(--vlaina-markdown-color-code-function)',
  constant: 'var(--vlaina-markdown-color-code-constant)',
  type: 'var(--vlaina-markdown-color-code-type)',
  operator: 'var(--vlaina-markdown-color-code-operator)',
  string: 'var(--vlaina-markdown-color-code-string)',
  variable: 'var(--vlaina-markdown-color-code-variable)',
  tag: 'var(--vlaina-markdown-color-code-tag)',
  markup: 'var(--vlaina-markdown-color-code-markup)',
  list: 'var(--vlaina-markdown-color-code-list)',
  invalid: 'var(--vlaina-markdown-color-code-invalid)',
};

export const codeBlockHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.comment, tags.meta],
    color: githubSyntax.muted,
  },
  {
    tag: [tags.keyword, tags.operatorKeyword, tags.modifier],
    color: githubSyntax.keyword,
  },
  {
    tag: [tags.name, tags.definition(tags.name), tags.className, tags.labelName],
    color: githubSyntax.name,
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: githubSyntax.function,
  },
  {
    tag: [tags.constant(tags.name), tags.standard(tags.name), tags.atom, tags.bool],
    color: githubSyntax.constant,
  },
  {
    tag: [tags.number, tags.color, tags.attributeName],
    color: githubSyntax.constant,
  },
  {
    tag: [tags.typeName, tags.namespace, tags.annotation],
    color: githubSyntax.type,
  },
  {
    tag: [tags.operator, tags.compareOperator, tags.arithmeticOperator, tags.logicOperator],
    color: githubSyntax.operator,
  },
  {
    tag: [tags.string, tags.regexp, tags.escape, tags.special(tags.string), tags.url],
    color: githubSyntax.string,
  },
  {
    tag: [tags.variableName, tags.special(tags.variableName)],
    color: githubSyntax.variable,
  },
  {
    tag: [tags.tagName],
    color: githubSyntax.tag,
  },
  {
    tag: [tags.heading],
    color: githubSyntax.markup,
    fontWeight: themeFontWeightTokens.bold,
  },
  {
    tag: [tags.list],
    color: githubSyntax.list,
  },
  {
    tag: tags.inserted,
    color: githubSyntax.tag,
  },
  {
    tag: tags.deleted,
    color: githubSyntax.invalid,
  },
  {
    tag: tags.strong,
    color: githubSyntax.foreground,
    fontWeight: themeFontWeightTokens.bold,
  },
  {
    tag: tags.emphasis,
    color: githubSyntax.foreground,
    fontStyle: 'italic',
  },
  {
    tag: tags.strikethrough,
    color: githubSyntax.foreground,
    textDecoration: 'line-through',
  },
  {
    tag: tags.link,
    color: githubSyntax.string,
    textDecoration: 'underline',
  },
  {
    tag: tags.invalid,
    color: githubSyntax.invalid,
  },
]);
