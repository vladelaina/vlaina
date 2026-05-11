import { visit } from 'unist-util-visit';

export const CHAT_STREAM_FADE_MS = 90;

const ANIMATED_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
const STATIC_TAGS = new Set(['pre', 'table', 'svg']);

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

function getTimingTextLength(node: any): number {
  if (node.tagName === 'img' && typeof node.properties?.alt === 'string') {
    return Array.from(node.properties.alt).length;
  }

  let length = 0;
  for (const child of node.children ?? []) {
    if (child.type === 'text' && typeof child.value === 'string') {
      length += Array.from(child.value).length;
    } else if (child.type === 'element') {
      length += getTimingTextLength(child);
    }
  }
  return length;
}

function formatOpacity(elapsed: number): string {
  const progress = Math.max(0, Math.min(1, elapsed / CHAT_STREAM_FADE_MS));
  return progress.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function appendClassName(node: any, className: string): void {
  const current = node.properties?.className;
  node.properties ??= {};

  if (Array.isArray(current)) {
    if (!current.includes(className)) {
      node.properties.className = [...current, className];
    }
    return;
  }

  if (typeof current === 'string' && current.trim()) {
    node.properties.className = current.includes(className)
      ? current
      : `${current} ${className}`;
    return;
  }

  node.properties.className = className;
}

function markPendingElementIfNeeded(
  node: any,
  className: string,
  firstCharIndex: number,
  lastCharIndex: number,
  births: number[],
  nowMs: number,
  revealed: boolean,
): void {
  if (revealed || lastCharIndex < firstCharIndex) {
    return;
  }

  const firstBirth = births[firstCharIndex];
  if (firstBirth != null && nowMs - firstBirth < 0) {
    appendClassName(node, className);
  }
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
            const isPending = !revealed && elapsed < 0;
            const isDone = revealed || elapsed >= CHAT_STREAM_FADE_MS;
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
          const childStartCharIndex = charIndex;
          if (shouldSkip(child)) {
            const timingTextLength = getTimingTextLength(child);
            if (timingTextLength > 0) {
              markPendingElementIfNeeded(
                child,
                'chat-stream-element-pending',
                childStartCharIndex,
                childStartCharIndex + timingTextLength - 1,
                births,
                nowMs,
                revealed,
              );
              charIndex += timingTextLength;
            }
          } else {
            wrapText(child);
            if (childStartCharIndex < charIndex) {
              markPendingElementIfNeeded(
                child,
                child.tagName === 'code'
                  ? 'chat-stream-inline-code-pending'
                  : 'chat-stream-element-pending',
                childStartCharIndex,
                charIndex - 1,
                births,
                nowMs,
                revealed,
              );
            } else {
              const timingTextLength = getTimingTextLength(child);
              if (timingTextLength > 0) {
                markPendingElementIfNeeded(
                  child,
                  'chat-stream-element-pending',
                  childStartCharIndex,
                  childStartCharIndex + timingTextLength - 1,
                  births,
                  nowMs,
                  revealed,
                );
                charIndex += timingTextLength;
              }
            }
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
