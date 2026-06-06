import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const codeBlockCompatibilityHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    class: 'cm-comment token comment',
  },
  {
    tag: [tags.meta, tags.documentMeta, tags.annotation, tags.processingInstruction],
    class: 'cm-meta token prolog token doctype token cdata token atrule token macro',
  },
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.self,
    ],
    class: 'cm-keyword token keyword',
  },
  {
    tag: tags.modifier,
    class: 'cm-keyword token keyword token important',
  },
  {
    tag: [tags.atom, tags.null, tags.unit],
    class: 'cm-atom token constant token symbol',
  },
  {
    tag: tags.bool,
    class: 'cm-atom token boolean token constant',
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.color],
    class: 'cm-number token number',
  },
  {
    tag: [tags.string, tags.docString],
    class: 'cm-string token string',
  },
  {
    tag: tags.character,
    class: 'cm-string token char token string',
  },
  {
    tag: tags.attributeValue,
    class: 'cm-string token attr-value token string',
  },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    class: 'cm-string-2 token regex token entity',
  },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName)],
    class: 'cm-property token property',
  },
  {
    tag: tags.function(tags.propertyName),
    class: 'cm-property token property token method token property-access',
  },
  {
    tag: tags.attributeName,
    class: 'cm-attribute token attr-name',
  },
  {
    tag: [tags.variableName, tags.special(tags.variableName), tags.function(tags.variableName)],
    class: 'cm-variable cm-variable-2 token variable token dom token function',
  },
  {
    tag: tags.local(tags.variableName),
    class: 'cm-variable cm-variable-2 token variable token dom token parameter',
  },
  {
    tag: [
      tags.standard(tags.variableName),
    ],
    class: 'cm-variable cm-variable-2 token variable token dom token builtin',
  },
  {
    tag: tags.standard(tags.propertyName),
    class: 'cm-property token property token builtin',
  },
  {
    tag: tags.standard(tags.className),
    class: 'cm-type token class-name token maybe-class-name token builtin',
  },
  {
    tag: tags.standard(tags.name),
    class: 'token builtin',
  },
  {
    tag: [tags.definition(tags.variableName), tags.definition(tags.name)],
    class: 'cm-def token function',
  },
  {
    tag: tags.macroName,
    class: 'cm-def token macro token property',
  },
  {
    tag: tags.typeName,
    class: 'cm-type token class-name',
  },
  {
    tag: tags.className,
    class: 'cm-type token class-name token maybe-class-name token selector',
  },
  {
    tag: [tags.namespace, tags.labelName],
    class: 'cm-qualifier token namespace token entity',
  },
  {
    tag: tags.tagName,
    class: 'cm-tag token tag token selector',
  },
  {
    tag: [
      tags.operator,
      tags.derefOperator,
      tags.arithmeticOperator,
      tags.logicOperator,
      tags.bitwiseOperator,
      tags.compareOperator,
      tags.updateOperator,
      tags.definitionOperator,
      tags.typeOperator,
      tags.controlOperator,
    ],
    class: 'cm-operator token operator',
  },
  {
    tag: [tags.punctuation, tags.separator],
    class: 'token punctuation',
  },
  {
    tag: [tags.bracket, tags.angleBracket, tags.squareBracket, tags.paren, tags.brace],
    class: 'cm-bracket token punctuation',
  },
  {
    tag: tags.strong,
    class: 'cm-strong token bold',
  },
  {
    tag: tags.emphasis,
    class: 'cm-em token italic',
  },
  {
    tag: tags.link,
    class: 'cm-link token url',
  },
  {
    tag: tags.url,
    class: 'token url',
  },
  {
    tag: tags.content,
    class: 'token plain-text',
  },
  {
    tag: tags.inserted,
    class: 'token inserted',
  },
  {
    tag: tags.deleted,
    class: 'token deleted',
  },
  {
    tag: tags.invalid,
    class: 'cm-error',
  },
]);
