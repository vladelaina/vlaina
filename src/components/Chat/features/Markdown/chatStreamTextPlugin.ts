import { visit } from 'unist-util-visit';
import { logChatStreamDebug } from '@/stores/notes/lineBreakDebugLog';

export const CHAT_STREAM_FADE_MS = 90;

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

function formatOpacity(elapsed: number): string {
  const progress = Math.max(0, Math.min(1, elapsed / CHAT_STREAM_FADE_MS));
  return progress.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function createChatStreamTextPlugin({
  births,
  charDelay,
  nowMs,
  revealed,
}: ChatStreamTextPluginOptions) {
  return (tree: any) => {
    let charIndex = 0;
    let pendingCount = 0;
    let activeCount = 0;
    let doneCount = 0;
    let wrappedTextNodes = 0;

    const wrapText = (node: any) => {
      const nextChildren: any[] = [];

      for (const child of node.children ?? []) {
        if (child.type === 'text') {
          wrappedTextNodes += 1;
          for (const char of child.value) {
            const birth = births[charIndex] ?? nowMs + charDelay * charIndex;
            const elapsed = nowMs - birth;
            const isPending = !revealed && elapsed < 0;
            const isDone = revealed || elapsed >= CHAT_STREAM_FADE_MS;
            if (isPending) {
              pendingCount += 1;
            } else if (isDone) {
              doneCount += 1;
            } else {
              activeCount += 1;
            }
            const properties: Record<string, string> = {
              className: isPending
                ? 'chat-stream-char chat-stream-char-pending'
                : isDone
                ? 'chat-stream-char chat-stream-char-done'
                : 'chat-stream-char',
            };

            if (!isDone && !isPending) {
              properties.style = `opacity:${formatOpacity(elapsed)}`;
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

    logChatStreamDebug('plugin:wrap', {
      births: births.length,
      nowMs,
      revealed,
      wrappedChars: charIndex,
      wrappedTextNodes,
      pendingCount,
      activeCount,
      doneCount,
    });
  };
}
