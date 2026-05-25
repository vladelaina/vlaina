export interface DefinitionListMdastNode {
  type: string;
  value?: string;
  children?: DefinitionListMdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

function getNodeText(node: DefinitionListMdastNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(getNodeText).join('');
}

function isParagraph(node: DefinitionListMdastNode | undefined): node is DefinitionListMdastNode {
  return node?.type === 'paragraph';
}

function stripDefinitionPrefix(children: readonly DefinitionListMdastNode[]): DefinitionListMdastNode[] {
  const nextChildren = children.map((child) => ({ ...child }));
  const firstText = nextChildren.find((child) => child.type === 'text' && typeof child.value === 'string');
  if (firstText?.value) {
    firstText.value = firstText.value.replace(/^:\s*/, '');
  }
  return nextChildren;
}

function createDefinitionListNode(
  termChildren: readonly DefinitionListMdastNode[],
  descChildren: readonly DefinitionListMdastNode[]
): DefinitionListMdastNode {
  return {
    type: 'definitionList',
    data: {
      hName: 'dl',
      hProperties: { className: ['definition-list'] },
    },
    children: [
      {
        type: 'definitionTerm',
        data: {
          hName: 'dt',
          hProperties: { className: ['definition-term'] },
        },
        children: [...termChildren],
      },
      {
        type: 'definitionDescription',
        data: {
          hName: 'dd',
          hProperties: { className: ['definition-desc'] },
        },
        children: [{
          type: 'paragraph',
          children: stripDefinitionPrefix(descChildren),
        }],
      },
    ],
  };
}

function splitCombinedDefinitionParagraph(node: DefinitionListMdastNode): DefinitionListMdastNode | null {
  if (!isParagraph(node) || node.children?.length !== 1) return null;
  const child = node.children[0];
  if (child.type !== 'text' || typeof child.value !== 'string') return null;

  const match = /^([^\n]{1,79})\n:\s+([\s\S]+)$/.exec(child.value);
  if (!match) return null;

  return createDefinitionListNode(
    [{ type: 'text', value: match[1] }],
    [{ type: 'text', value: match[2] }]
  );
}

export function applyDefinitionListsToTree(tree: DefinitionListMdastNode): void {
  function visit(node: DefinitionListMdastNode): void {
    if (!node.children?.length) return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      const combined = splitCombinedDefinitionParagraph(child);
      if (combined) {
        node.children.splice(index, 1, combined);
        continue;
      }

      const next = node.children[index + 1];
      const termText = isParagraph(child) ? getNodeText(child).trim() : '';
      const descText = isParagraph(next) ? getNodeText(next).trimStart() : '';
      if (
        termText.length > 0 &&
        termText.length < 80 &&
        descText.startsWith(': ') &&
        child.children &&
        next?.children
      ) {
        node.children.splice(index, 2, createDefinitionListNode(child.children, next.children));
        continue;
      }

      visit(child);
    }
  }

  visit(tree);
}

export function remarkDefinitionLists() {
  return (tree: DefinitionListMdastNode) => {
    applyDefinitionListsToTree(tree);
  };
}
