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

function getBirthElapsed(
  births: number[],
  charDelay: number,
  nowMs: number,
  charIndex: number,
): number {
  const birth = births[charIndex] ?? nowMs + charDelay * charIndex;
  return nowMs - birth;
}

function formatMs(value: number): string {
  return `${Math.round(value * 1000) / 1000}ms`;
}

function buildFadeAnimationStyle(birth: number, nowMs: number): string {
  return [
    'animation-name:chat-stream-char-fade',
    `animation-duration:${CHAT_STREAM_FADE_MS}ms`,
    'animation-timing-function:ease-out',
    `animation-delay:${formatMs(birth - nowMs)}`,
    'animation-fill-mode:both',
  ].join(';');
}

function animateElementIfNeeded(
  node: any,
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
  if (firstBirth == null || nowMs - firstBirth >= CHAT_STREAM_FADE_MS) {
    return;
  }

  node.properties ??= {};
  const existingStyle = typeof node.properties.style === 'string' && node.properties.style.trim()
    ? `${node.properties.style};`
    : '';
  node.properties.style = `${existingStyle}${buildFadeAnimationStyle(firstBirth, nowMs)}`;
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
      const pushDoneText = (value: string) => {
        if (!value) {
          return;
        }

        const previous = nextChildren[nextChildren.length - 1];
        if (previous?.type === 'text' && typeof previous.value === 'string') {
          previous.value += value;
          return;
        }

        nextChildren.push({ type: 'text', value });
      };

      for (const child of node.children ?? []) {
        if (child.type === 'text') {
          const textChars = Array.from(child.value);
          if (textChars.length === 0) {
            continue;
          }

          const lastCharIndex = charIndex + textChars.length - 1;
          if (revealed || getBirthElapsed(births, charDelay, nowMs, lastCharIndex) >= CHAT_STREAM_FADE_MS) {
            pushDoneText(child.value);
            charIndex += textChars.length;
            continue;
          }

          let doneBuffer = '';

          for (const char of textChars) {
            const birth = births[charIndex] ?? nowMs + charDelay * charIndex;
            const elapsed = nowMs - birth;
            const isDone = revealed || elapsed >= CHAT_STREAM_FADE_MS;
            if (isDone) {
              doneBuffer += char;
              charIndex += 1;
              continue;
            }

            pushDoneText(doneBuffer);
            doneBuffer = '';
            const properties: Record<string, string> = {
              className: 'chat-stream-char',
              style: buildFadeAnimationStyle(birth, nowMs),
            };

            nextChildren.push({
              children: [{ type: 'text', value: char }],
              properties,
              tagName: 'span',
              type: 'element',
            });
            charIndex += 1;
          }

          pushDoneText(doneBuffer);
        } else if (child.type === 'element') {
          const childStartCharIndex = charIndex;
          if (shouldSkip(child)) {
            const timingTextLength = getTimingTextLength(child);
            if (timingTextLength > 0) {
              animateElementIfNeeded(
                child,
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
              animateElementIfNeeded(
                child,
                childStartCharIndex,
                charIndex - 1,
                births,
                nowMs,
                revealed,
              );
            } else {
              const timingTextLength = getTimingTextLength(child);
              if (timingTextLength > 0) {
                animateElementIfNeeded(
                  child,
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
