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

function collectCodeBlockText(node: CodeBlockTextNode): string {
  if (node.isText) {
    return node.text ?? '';
  }

  if (node.type?.name === 'hard_break') {
    return '\n';
  }

  let text = '';
  node.content?.forEach?.((child) => {
    text += collectCodeBlockText(child);
  });
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
