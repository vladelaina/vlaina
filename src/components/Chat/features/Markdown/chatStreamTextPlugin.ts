import {
  canTransformChatStreamHast,
  getChatStreamHastChildren,
  getChatStreamTimingTextLength,
} from './chatStreamHastBudget';
import { getCodePointLength } from './chatStreamTextMetrics';

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

function pushDoneText(nextChildren: any[], value: string): void {
  if (!value) {
    return;
  }

  const previous = nextChildren[nextChildren.length - 1];
  if (previous?.type === 'text' && typeof previous.value === 'string') {
    previous.value += value;
    return;
  }

  nextChildren.push({ type: 'text', value });
}

function handleTextChild(
  child: any,
  nextChildren: any[],
  charIndex: number,
  births: number[],
  charDelay: number,
  nowMs: number,
  revealed: boolean,
): number {
  if (typeof child.value !== 'string') {
    nextChildren.push(child);
    return charIndex;
  }

  const textLength = getCodePointLength(child.value);
  if (textLength === 0) {
    return charIndex;
  }

  const lastCharIndex = charIndex + textLength - 1;
  if (revealed || getBirthElapsed(births, charDelay, nowMs, lastCharIndex) >= CHAT_STREAM_FADE_MS) {
    pushDoneText(nextChildren, child.value);
    return charIndex + textLength;
  }

  let doneBuffer = '';
  let nextCharIndex = charIndex;

  for (const char of child.value) {
    const birth = births[nextCharIndex] ?? nowMs + charDelay * nextCharIndex;
    const elapsed = nowMs - birth;
    const isDone = revealed || elapsed >= CHAT_STREAM_FADE_MS;
    if (isDone) {
      doneBuffer += char;
      nextCharIndex += 1;
      continue;
    }

    pushDoneText(nextChildren, doneBuffer);
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
    nextCharIndex += 1;
  }

  pushDoneText(nextChildren, doneBuffer);
  return nextCharIndex;
}

interface WrapFrame {
  children: any[];
  index: number;
  nextChildren: any[];
  node: any;
  parent: WrapFrame | null;
  startCharIndex: number;
}

function createWrapFrame(node: any, parent: WrapFrame | null, startCharIndex: number): WrapFrame {
  return {
    children: getChatStreamHastChildren(node),
    index: 0,
    nextChildren: [],
    node,
    parent,
    startCharIndex,
  };
}

export function createChatStreamTextPlugin({
  births,
  charDelay,
  nowMs,
  revealed,
}: ChatStreamTextPluginOptions) {
  return (tree: any) => {
    if (!canTransformChatStreamHast(tree)) {
      return;
    }

    let charIndex = 0;

    const wrapText = (node: any) => {
      const stack = [createWrapFrame(node, null, charIndex)];

      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;

        if (frame.index >= frame.children.length) {
          frame.node.children = frame.nextChildren;
          stack.pop();
          if (frame.parent) {
            if (frame.startCharIndex < charIndex) {
              animateElementIfNeeded(
                frame.node,
                frame.startCharIndex,
                charIndex - 1,
                births,
                nowMs,
                revealed,
              );
            } else {
              const timingTextLength = getChatStreamTimingTextLength(frame.node);
              if (timingTextLength > 0) {
                animateElementIfNeeded(
                  frame.node,
                  frame.startCharIndex,
                  frame.startCharIndex + timingTextLength - 1,
                  births,
                  nowMs,
                  revealed,
                );
                charIndex += timingTextLength;
              }
            }
            frame.parent.nextChildren.push(frame.node);
          }
          continue;
        }

        const child = frame.children[frame.index]!;
        frame.index += 1;

        if (child.type === 'text') {
          charIndex = handleTextChild(
            child,
            frame.nextChildren,
            charIndex,
            births,
            charDelay,
            nowMs,
            revealed,
          );
        } else if (child.type === 'element') {
          const childStartCharIndex = charIndex;
          if (shouldSkip(child)) {
            const timingTextLength = getChatStreamTimingTextLength(child);
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
            frame.nextChildren.push(child);
          } else {
            stack.push(createWrapFrame(child, frame, childStartCharIndex));
          }
        } else {
          frame.nextChildren.push(child);
        }
      }
    };

    const stack = [tree];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node?.type !== 'element') {
        const children = getChatStreamHastChildren(node);
        for (let index = children.length - 1; index >= 0; index -= 1) {
          stack.push(children[index]);
        }
        continue;
      }

      if (shouldSkip(node)) {
        continue;
      }

      if (ANIMATED_TAGS.has(node.tagName)) {
        wrapText(node);
        continue;
      }

      const children = getChatStreamHastChildren(node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push(children[index]);
      }
    }
  };
}
