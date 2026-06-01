import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const githubSyntax = {
  foreground: 'var(--vlaina-code-syntax-foreground)',
  muted: 'var(--vlaina-code-syntax-muted)',
  keyword: 'var(--vlaina-code-syntax-keyword)',
  name: 'var(--vlaina-code-syntax-name)',
  function: 'var(--vlaina-code-syntax-function)',
  constant: 'var(--vlaina-code-syntax-constant)',
  type: 'var(--vlaina-code-syntax-type)',
  operator: 'var(--vlaina-code-syntax-operator)',
  string: 'var(--vlaina-code-syntax-string)',
  variable: 'var(--vlaina-code-syntax-variable)',
  tag: 'var(--vlaina-code-syntax-tag)',
  markup: 'var(--vlaina-code-syntax-markup)',
  list: 'var(--vlaina-code-syntax-list)',
  invalid: 'var(--vlaina-code-syntax-invalid)',
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
