import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import { SKIP, visitParents } from 'unist-util-visit-parents';
import { renderLatex } from './katexRenderer';

const EMPTY_CLASSES: readonly unknown[] = [];

export function rehypeNotesKatex() {
  return (tree: any) => {
    visitParents(tree, 'element', (element: any, parents: any[]) => {
      const classes = Array.isArray(element.properties?.className)
        ? element.properties.className
        : EMPTY_CLASSES;
      const languageMath = classes.includes('language-math');
      const mathDisplay = classes.includes('math-display');
      const mathInline = classes.includes('math-inline');
      if (!languageMath && !mathDisplay && !mathInline) return;

      let parent = parents[parents.length - 1];
      let scope = element;
      let displayMode = mathDisplay;

      if (
        element.tagName === 'code'
        && languageMath
        && parent?.type === 'element'
        && parent.tagName === 'pre'
      ) {
        scope = parent;
        parent = parents[parents.length - 2];
        displayMode = true;
      }
      if (!parent) return;

      const latex = toText(scope, { whitespace: 'pre' });
      const rendered = renderLatex(latex, displayMode);
      const result = fromHtmlIsomorphic(rendered.html, { fragment: true }).children;
      const index = parent.children.indexOf(scope);
      parent.children.splice(index, 1, ...result);
      return SKIP;
    });
  };
}
