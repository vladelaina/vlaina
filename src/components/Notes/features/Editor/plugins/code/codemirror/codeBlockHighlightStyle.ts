import { HighlightStyle, type TagStyle } from '@codemirror/language';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';

const oneDarkColorVariables: Record<string, string> = {
  '#abb2bf': 'var(--vlaina-code-syntax-foreground, #abb2bf)',
  '#7d8799': 'var(--vlaina-code-syntax-muted, #7d8799)',
  '#c678dd': 'var(--vlaina-code-syntax-keyword, #c678dd)',
  '#e06c75': 'var(--vlaina-code-syntax-name, #e06c75)',
  '#61afef': 'var(--vlaina-code-syntax-function, #61afef)',
  '#d19a66': 'var(--vlaina-code-syntax-constant, #d19a66)',
  '#e5c07b': 'var(--vlaina-code-syntax-type, #e5c07b)',
  '#56b6c2': 'var(--vlaina-code-syntax-operator, #56b6c2)',
  '#98c379': 'var(--vlaina-code-syntax-string, #98c379)',
  '#ffffff': 'var(--vlaina-code-syntax-invalid, #ffffff)',
};

export const vlainaCodeBlockHighlightStyle = HighlightStyle.define(
  oneDarkHighlightStyle.specs.map((spec): TagStyle => {
    if (!spec.color) {
      return spec;
    }

    return {
      ...spec,
      color: oneDarkColorVariables[spec.color] ?? spec.color,
    };
  })
);
