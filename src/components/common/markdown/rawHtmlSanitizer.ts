import {
  GITHUB_DROP_WITH_CONTENT_TAGS,
  GITHUB_SANITIZER_ONLY_DROP_WITH_CONTENT_TAGS,
} from '@/lib/notes/markdown/githubHtmlPolicy';
import { prepareGithubRawHtmlForMarkdownSanitizerFragment } from '@/lib/notes/markdown/githubRawHtml';

const MAX_RAW_HTML_HAST_DEPTH = 200;
const MAX_RAW_HTML_HAST_NODES = 20_000;

interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
}

interface RawHtmlState {
  activeDepth: number;
  activeMode: 'drop' | 'escape' | null;
  activeTag: string | null;
}

const NO_RAW_HTML_TAGS = new Set<string>();

function isDroppedRawHtmlElement(node: HastNode): boolean {
  return (
    node.type === 'element' &&
    typeof node.tagName === 'string' &&
    GITHUB_DROP_WITH_CONTENT_TAGS.has(node.tagName.toLowerCase())
  );
}

function sanitizeRawHtmlNode(node: HastNode, state: RawHtmlState): boolean {
  if (node.type !== 'raw' || typeof node.value !== 'string') {
    return true;
  }

  const result = prepareGithubRawHtmlForMarkdownSanitizerFragment(
    node.value,
    state.activeTag,
    state.activeMode,
    { activeDepth: state.activeDepth },
  );
  state.activeTag = result.activeTag;
  state.activeMode = result.mode;
  state.activeDepth = result.activeDepth || 1;
  if (!result.value) {
    return false;
  }

  node.value = result.value;
  return true;
}

function syncTextRawHtmlState(node: HastNode, state: RawHtmlState): boolean {
  if (node.type !== 'text' || typeof node.value !== 'string') {
    return true;
  }

  if (state.activeTag && state.activeMode !== 'drop') {
    return true;
  }

  const result = prepareGithubRawHtmlForMarkdownSanitizerFragment(
    node.value,
    state.activeTag,
    state.activeMode,
    {
      activeDepth: state.activeDepth,
      dropTags: GITHUB_SANITIZER_ONLY_DROP_WITH_CONTENT_TAGS,
      escapeTags: NO_RAW_HTML_TAGS,
    },
  );
  state.activeTag = result.activeTag;
  state.activeMode = result.mode;
  state.activeDepth = result.activeDepth || 1;
  if (!result.value) {
    return false;
  }

  node.value = result.value;
  return true;
}

export function dropUnsafeRawHtmlContent(node: HastNode): void {
  const rawHtmlState: RawHtmlState = {
    activeDepth: 1,
    activeMode: null,
    activeTag: null,
  };
  const stack: Array<{
    depth: number;
    enteredDroppedRawHtml: boolean;
    index: number;
    node: HastNode;
    parentChildren?: HastNode[];
    parentIndex?: number;
  }> = [{ node, depth: 0, index: 0, enteredDroppedRawHtml: false }];
  let visitedNodes = 1;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const children = current.node.children;
    if (!Array.isArray(children)) {
      stack.pop();
      continue;
    }

    if (current.depth >= MAX_RAW_HTML_HAST_DEPTH) {
      current.node.children = [];
      current.index = children.length;
    }

    if (current.index >= children.length) {
      stack.pop();
      if (
        current.enteredDroppedRawHtml &&
        current.node.children?.length === 0 &&
        current.parentChildren &&
        typeof current.parentIndex === 'number'
      ) {
        current.parentChildren.splice(current.parentIndex, 1);
        const parent = stack[stack.length - 1];
        if (parent && parent.index > current.parentIndex) {
          parent.index = current.parentIndex;
        }
      }
      continue;
    }

    const child = children[current.index];
    if (!child) {
      children.splice(current.index, 1);
      continue;
    }

    if (!syncTextRawHtmlState(child, rawHtmlState)) {
      children.splice(current.index, 1);
      continue;
    }

    const childChildren = child.children;
    if (
      rawHtmlState.activeTag &&
      rawHtmlState.activeMode === 'drop' &&
      child.type !== 'raw' &&
      !Array.isArray(childChildren)
    ) {
      children.splice(current.index, 1);
      continue;
    }

    if (!sanitizeRawHtmlNode(child, rawHtmlState) || isDroppedRawHtmlElement(child)) {
      children.splice(current.index, 1);
      continue;
    }

    visitedNodes += 1;
    if (visitedNodes > MAX_RAW_HTML_HAST_NODES) {
      children.splice(current.index);
      stack.pop();
      continue;
    }

    current.index += 1;
    if (Array.isArray(childChildren)) {
      stack.push({
        node: child,
        depth: current.depth + 1,
        index: 0,
        enteredDroppedRawHtml: Boolean(rawHtmlState.activeTag && rawHtmlState.activeMode === 'drop'),
        parentChildren: children,
        parentIndex: current.index - 1,
      });
    }
  }
}

export function rehypeDropUnsafeRawHtmlContent() {
  return (tree: HastNode) => {
    dropUnsafeRawHtmlContent(tree);
  };
}
