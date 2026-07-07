import { Fragment } from '@milkdown/kit/prose/model';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';

function createHardBreak(view: EditorView): ProseNode | null {
  const hardBreakType = view.state.schema.nodes.hardbreak ?? view.state.schema.nodes.hard_break;
  return hardBreakType?.create() ?? null;
}

function createPlainTextFragmentFromFrontmatter(view: EditorView, node: ProseNode): Fragment {
  const frontmatterText = node.textContent.replace(/\r\n?/g, '\n');
  const lines = frontmatterText.length > 0 ? frontmatterText.split('\n') : [''];
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return Fragment.empty;

  const content: ProseNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      const hardBreak = createHardBreak(view);
      if (hardBreak) {
        content.push(hardBreak);
      }
    }
    if (line.length > 0) {
      content.push(view.state.schema.text(line));
    }
  });

  return Fragment.from(paragraphType.create(null, content));
}

export function convertMovedFrontmatterToPlainText(
  view: EditorView,
  content: Fragment,
  targetPos: number,
): Fragment {
  if (targetPos === 0) return content;

  let converted = Fragment.empty;
  content.forEach((child) => {
    converted = converted.append(
      child.type.name === 'frontmatter'
        ? createPlainTextFragmentFromFrontmatter(view, child)
        : Fragment.from(child)
    );
  });
  return converted;
}
