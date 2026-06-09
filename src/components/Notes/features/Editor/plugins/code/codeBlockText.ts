type CodeBlockTextNode = {
  isText?: boolean;
  text?: string | null;
  textContent?: string;
  textBetween?: (
    from: number,
    to: number,
    blockSeparator?: string,
    leafText?: string,
  ) => string;
  type?: { name?: string };
  content?: {
    size?: number;
    forEach?: (callback: (child: CodeBlockTextNode) => void) => void;
  };
};

export const MAX_CODE_BLOCK_FALLBACK_TEXT_NODES = 20_000;

function collectCodeBlockText(node: CodeBlockTextNode): string {
  let text = '';
  let scanned = 0;
  const stack: CodeBlockTextNode[] = [node];

  while (stack.length > 0 && scanned < MAX_CODE_BLOCK_FALLBACK_TEXT_NODES) {
    const current = stack.pop();
    if (!current) continue;
    scanned += 1;

    if (current.isText) {
      text += current.text ?? '';
      continue;
    }

    if (current.type?.name === 'hard_break') {
      text += '\n';
      continue;
    }

    const children: CodeBlockTextNode[] = [];
    current.content?.forEach?.((child) => {
      children.push(child);
    });

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return text;
}

export function getCodeBlockSourceText(node: CodeBlockTextNode): string {
  const contentSize = node.content?.size;
  if (typeof node.textBetween === 'function' && typeof contentSize === 'number') {
    return node.textBetween(0, contentSize, '\n', '\n');
  }

  if (typeof node.textContent === 'string') {
    return node.textContent;
  }

  return collectCodeBlockText(node);
}
