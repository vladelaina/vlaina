export interface AbbrDefinition {
  abbr: string;
  fullText: string;
}

export interface AbbrMdastNode {
  type: string;
  value?: string;
  children?: AbbrMdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

const ABBR_DEF_REGEX = /^\*\[([^\]]+)\]:\s*(.+)$/gm;

function escapeRegex(value: string): string {
  let result = '';
  for (const char of value) {
    if ('.*+?^${}()|[]\\'.includes(char)) {
      result += '\\' + char;
    } else {
      result += char;
    }
  }
  return result;
}

export function extractAbbrDefinitionsFromText(text: string): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];
  let match: RegExpExecArray | null;

  ABBR_DEF_REGEX.lastIndex = 0;
  while ((match = ABBR_DEF_REGEX.exec(text)) !== null) {
    definitions.push({
      abbr: match[1],
      fullText: match[2].trim(),
    });
  }

  return definitions;
}

export function createAbbrUsagePattern(definitions: readonly AbbrDefinition[]): RegExp | null {
  if (definitions.length === 0) return null;
  const escapedAbbrs = definitions.map((definition) => escapeRegex(definition.abbr));
  return new RegExp(`\\b(${escapedAbbrs.join('|')})\\b`, 'g');
}

function collectAbbrDefinitions(tree: AbbrMdastNode): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];

  function visit(node: AbbrMdastNode): void {
    if (node.type === 'text' && typeof node.value === 'string') {
      definitions.push(...extractAbbrDefinitionsFromText(node.value));
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(tree);
  return definitions;
}

function isAbbrDefinitionText(value: string): boolean {
  ABBR_DEF_REGEX.lastIndex = 0;
  return ABBR_DEF_REGEX.test(value);
}

function createAbbrNode(value: string, title: string): AbbrMdastNode {
  return {
    type: 'abbr',
    children: [{ type: 'text', value }],
    data: {
      hName: 'abbr',
      hProperties: {
        title,
        className: ['abbr'],
      },
    },
  };
}

export function applyAbbrDefinitionsToTree(tree: AbbrMdastNode): void {
  const definitions = collectAbbrDefinitions(tree);
  const usagePattern = createAbbrUsagePattern(definitions);
  if (!usagePattern) return;

  const activePattern = usagePattern;
  const definitionByAbbr = new Map(definitions.map((definition) => [definition.abbr, definition.fullText]));

  function visit(node: AbbrMdastNode, parent?: AbbrMdastNode, index?: number): void {
    if (node.children) {
      for (let childIndex = node.children.length - 1; childIndex >= 0; childIndex -= 1) {
        visit(node.children[childIndex], node, childIndex);
      }
    }

    if (node.type !== 'text' || !node.value || !parent || index === undefined) return;
    if (isAbbrDefinitionText(node.value)) return;

    const nextNodes: AbbrMdastNode[] = [];
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    const pattern = activePattern;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(node.value)) !== null) {
      const abbr = match[1];
      const fullText = definitionByAbbr.get(abbr);
      if (!fullText) continue;

      if (match.index > lastEnd) {
        nextNodes.push({ type: 'text', value: node.value.slice(lastEnd, match.index) });
      }
      nextNodes.push(createAbbrNode(abbr, fullText));
      lastEnd = match.index + abbr.length;
    }

    if (nextNodes.length === 0) return;
    if (lastEnd < node.value.length) {
      nextNodes.push({ type: 'text', value: node.value.slice(lastEnd) });
    }

    parent.children?.splice(index, 1, ...nextNodes);
  }

  visit(tree);
}

export function remarkAbbrDefinitions() {
  return (tree: AbbrMdastNode) => {
    applyAbbrDefinitionsToTree(tree);
  };
}
