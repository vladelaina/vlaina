import { visit } from 'unist-util-visit';

export const CHAT_STREAM_FADE_MS = 360;

const ANIMATED_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
const STATIC_TAGS = new Set(['pre', 'code', 'table', 'svg']);

interface ChatStreamTextPluginOptions {
  births: number[];
  charDelay: number;
  nowMs: number;
  revealed: boolean;
}

function hasClass(node: any, className: string): boolean {
  const value = node.properties?.className;
  if (Array.isArray(value)) {
    return value.some((item) => String(item).includes(className));
  }
  return typeof value === 'string' && value.includes(className);
}

function shouldSkip(node: any): boolean {
  return STATIC_TAGS.has(node.tagName) || hasClass(node, 'katex');
}

export function createChatStreamTextPlugin({
  births,
  charDelay,
  nowMs,
  revealed,
}: ChatStreamTextPluginOptions) {
  return (tree: any) => {
    let charIndex = 0;

    const wrapText = (node: any) => {
      const nextChildren: any[] = [];

      for (const child of node.children ?? []) {
        if (child.type === 'text') {
          for (const char of child.value) {
            const birth = births[charIndex] ?? nowMs + charDelay * charIndex;
            const elapsed = nowMs - birth;
            const isDone = revealed || elapsed >= CHAT_STREAM_FADE_MS;
            const properties: Record<string, string> = {
              className: isDone
                ? 'chat-stream-char chat-stream-char-done'
                : 'chat-stream-char',
            };

            if (!isDone) {
              properties.style = `animation-delay:${-elapsed}ms`;
            }

            nextChildren.push({
              children: [{ type: 'text', value: char }],
              properties,
              tagName: 'span',
              type: 'element',
            });
            charIndex += 1;
          }
        } else if (child.type === 'element') {
          if (!shouldSkip(child)) {
            wrapText(child);
          }
          nextChildren.push(child);
        } else {
          nextChildren.push(child);
        }
      }

      node.children = nextChildren;
    };

    visit(tree, 'element', (node: any) => {
      if (shouldSkip(node)) {
        return 'skip';
      }

      if (ANIMATED_TAGS.has(node.tagName)) {
        wrapText(node);
        return 'skip';
      }
    });
  };
}
