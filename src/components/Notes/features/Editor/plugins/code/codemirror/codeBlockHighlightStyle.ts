import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const githubSyntax = {
  foreground: 'var(--vlaina-code-syntax-foreground, #24292e)',
  muted: 'var(--vlaina-code-syntax-muted, #6a737d)',
  keyword: 'var(--vlaina-code-syntax-keyword, #d73a49)',
  name: 'var(--vlaina-code-syntax-name, #6f42c1)',
  function: 'var(--vlaina-code-syntax-function, #6f42c1)',
  constant: 'var(--vlaina-code-syntax-constant, #005cc5)',
  type: 'var(--vlaina-code-syntax-type, #d73a49)',
  operator: 'var(--vlaina-code-syntax-operator, #24292e)',
  string: 'var(--vlaina-code-syntax-string, #032f62)',
  variable: 'var(--vlaina-code-syntax-variable, #e36209)',
  tag: 'var(--vlaina-code-syntax-tag, #22863a)',
  markup: 'var(--vlaina-code-syntax-markup, #005cc5)',
  list: 'var(--vlaina-code-syntax-list, #735c0f)',
  invalid: 'var(--vlaina-code-syntax-invalid, #b31d28)',
};

export const vlainaCodeBlockHighlightStyle = HighlightStyle.define([
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
    fontWeight: '700',
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
    fontWeight: '700',
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
