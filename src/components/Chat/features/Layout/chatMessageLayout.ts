import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag, stripErrorTags } from '@/lib/ai/errorTag';
import { extractMessageImageSources, stripMarkdownImageTokens } from '@/components/Chat/common/messageClipboard';
import { measureTextBlockHeight } from '@/lib/text-layout';

const CHAT_CONTENT_MAX_WIDTH = 850;
const CHAT_CONTENT_PADDING_X = 32;
const USER_BUBBLE_MAX_RATIO = 0.9;
const USER_BUBBLE_PADDING_X = 32;
const USER_BUBBLE_PADDING_Y = 12;
const USER_IMAGE_HEIGHT = 256;
const USER_STACK_GAP = 8;
const USER_TOOLBAR_HEIGHT = 30;

const ASSISTANT_LEFT_PADDING = 15;
const ASSISTANT_TOOLBAR_HEIGHT = 30;
const ASSISTANT_INLINE_LOADING_HEIGHT = 24;
const ASSISTANT_IMAGE_HEIGHT = 220;
const ASSISTANT_IMAGE_GAP = 12;
const ASSISTANT_CODE_HEADER_HEIGHT = 36;
const ASSISTANT_CODE_PADDING_Y = 16;
const ASSISTANT_BLOCK_GAP = 20;
const ASSISTANT_THINKING_HEADER_HEIGHT = 28;
const ASSISTANT_THINKING_BODY_GAP = 8;
const ASSISTANT_THINKING_MARGIN_BOTTOM = 16;
const ASSISTANT_ERROR_MARGIN_TOP = 8;
const ASSISTANT_ERROR_MARGIN_BOTTOM = 8;

const BODY_FONT = 'normal 400 15px Inter, "Source Sans 3", "Poppins", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const ERROR_FONT = 'normal 400 14px Inter, "Source Sans 3", "Poppins", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const BODY_LINE_HEIGHT = 24;
const CODE_LINE_HEIGHT = 23;
const ERROR_LINE_HEIGHT = 22;

const THINK_TAG_RE = /<think>([\s\S]*?)(?:<\/think>|$)/i;
const CODE_FENCE_RE = /```[^\n]*\n?([\s\S]*?)```/g;
const HTML_IMAGE_RE = /<img\b[^>]*>/gi;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const INLINE_CODE_RE = /`([^`]+)`/g;

type EstimatedChatMessageHeightOptions = {
  containerWidth: number;
  isStreaming: boolean;
};

type ThinkingSections = {
  body: string;
  isComplete: boolean;
  markdown: string;
};

function getChatContentWidth(containerWidth: number): number {
  return Math.max(240, Math.min(CHAT_CONTENT_MAX_WIDTH, containerWidth - CHAT_CONTENT_PADDING_X));
}

function extractThinkingSections(content: string): ThinkingSections {
  const match = THINK_TAG_RE.exec(content);
  if (!match) {
    return {
      body: '',
      isComplete: true,
      markdown: content,
    };
  }

  const body = match[1] ?? '';
  const isComplete = content.includes('</think>');
  const markdown = content.replace(match[0], '');
  return { body, isComplete, markdown };
}

function stripRenderableImageTokens(content: string): string {
  return stripMarkdownImageTokens(content).replace(HTML_IMAGE_RE, '');
}

function normalizeMarkdownForMeasurement(content: string): string {
  return content
    .replace(CODE_FENCE_RE, '\n')
    .replace(MARKDOWN_LINK_RE, '$1')
    .replace(INLINE_CODE_RE, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countRenderableImages(content: string): number {
  return extractMessageImageSources(content).length;
}

function measureWrappedBodyHeight(text: string, width: number): number {
  return measureTextBlockHeight(text, width, {
    font: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    minHeight: BODY_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });
}

function measureErrorHeight(text: string, width: number): number {
  return measureTextBlockHeight(text, width, {
    font: ERROR_FONT,
    lineHeight: ERROR_LINE_HEIGHT,
    minHeight: ERROR_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });
}

function estimateCodeBlockHeight(code: string): number {
  const lineCount = Math.max(code.replace(/\n$/, '').split('\n').length, 1);
  return ASSISTANT_CODE_HEADER_HEIGHT + ASSISTANT_CODE_PADDING_Y + lineCount * CODE_LINE_HEIGHT;
}

function estimateThinkingHeight(thinking: ThinkingSections, contentWidth: number, isStreaming: boolean): number {
  if (!thinking.body) {
    return 0;
  }

  if (!isStreaming && thinking.isComplete) {
    return ASSISTANT_THINKING_HEADER_HEIGHT;
  }

  const bodyHeight = measureTextBlockHeight(thinking.body, contentWidth, {
    font: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    minHeight: BODY_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });

  return ASSISTANT_THINKING_HEADER_HEIGHT + ASSISTANT_THINKING_BODY_GAP + bodyHeight;
}

function estimateUserMessageHeight(message: ChatMessage, containerWidth: number): number {
  const contentWidth = getChatContentWidth(containerWidth);
  const bubbleWidth = Math.max(120, Math.floor(contentWidth * USER_BUBBLE_MAX_RATIO));
  const textWidth = Math.max(1, bubbleWidth - USER_BUBBLE_PADDING_X);
  const text = stripRenderableImageTokens(message.content).trim();
  const imageCount = countRenderableImages(message.content);

  let height = 0;

  if (imageCount > 0) {
    height += imageCount * USER_IMAGE_HEIGHT + Math.max(0, imageCount - 1) * USER_STACK_GAP;
  }

  if (text.length > 0) {
    if (height > 0) {
      height += USER_STACK_GAP;
    }
    height += measureTextBlockHeight(text, textWidth, {
      font: BODY_FONT,
      lineHeight: BODY_LINE_HEIGHT,
      minHeight: BODY_LINE_HEIGHT,
      prepareOptions: { whiteSpace: 'pre-wrap' },
    }) + USER_BUBBLE_PADDING_Y;
  }

  if (height === 0) {
    height = BODY_LINE_HEIGHT + USER_BUBBLE_PADDING_Y;
  }

  return height + USER_TOOLBAR_HEIGHT;
}

function estimateAssistantMessageHeight(
  message: ChatMessage,
  containerWidth: number,
  isStreaming: boolean,
): number {
  const contentWidth = Math.max(1, getChatContentWidth(containerWidth) - ASSISTANT_LEFT_PADDING);
  const parsedError = parseErrorTag(message.content);
  const contentWithoutError = stripErrorTags(message.content);
  const thinking = extractThinkingSections(contentWithoutError);
  const markdownWithoutImages = stripRenderableImageTokens(thinking.markdown);
  const normalizedMarkdown = normalizeMarkdownForMeasurement(markdownWithoutImages);
  const imageCount = countRenderableImages(thinking.markdown);
  const codeBlocks = Array.from(thinking.markdown.matchAll(CODE_FENCE_RE), (match) => match[1] ?? '');

  let height = 0;

  const thinkingHeight = estimateThinkingHeight(thinking, contentWidth, isStreaming);
  if (thinkingHeight > 0) {
    height += thinkingHeight;
    if (normalizedMarkdown || imageCount > 0 || parsedError?.content) {
      height += ASSISTANT_THINKING_MARGIN_BOTTOM;
    }
  }

  if (normalizedMarkdown) {
    height += measureWrappedBodyHeight(normalizedMarkdown, contentWidth);
  }

  if (codeBlocks.length > 0) {
    if (height > 0) {
      height += ASSISTANT_BLOCK_GAP;
    }
    height += codeBlocks.reduce((sum, block, index) => {
      const nextHeight = estimateCodeBlockHeight(block);
      if (index === 0) {
        return sum + nextHeight;
      }
      return sum + ASSISTANT_BLOCK_GAP + nextHeight;
    }, 0);
  }

  if (imageCount > 0) {
    if (height > 0) {
      height += ASSISTANT_BLOCK_GAP;
    }
    height += imageCount * ASSISTANT_IMAGE_HEIGHT + Math.max(0, imageCount - 1) * ASSISTANT_IMAGE_GAP;
  }

  if (parsedError?.content) {
    if (height > 0) {
      height += ASSISTANT_ERROR_MARGIN_TOP;
    }
    height += measureErrorHeight(parsedError.content, contentWidth) + ASSISTANT_ERROR_MARGIN_BOTTOM;
  }

  const hasVisibleAssistantOutput =
    normalizedMarkdown.length > 0 || imageCount > 0 || parsedError?.content || thinkingHeight > 0;
  if (isStreaming && hasVisibleAssistantOutput) {
    height += ASSISTANT_INLINE_LOADING_HEIGHT;
  }

  if (!isStreaming) {
    height += ASSISTANT_TOOLBAR_HEIGHT;
  }

  return Math.max(height, BODY_LINE_HEIGHT);
}

export function estimateChatLoadingHeight(): number {
  return 24;
}

export function estimateChatMessageHeight(
  message: ChatMessage,
  { containerWidth, isStreaming }: EstimatedChatMessageHeightOptions,
): number {
  if (message.role === 'user') {
    return estimateUserMessageHeight(message, containerWidth);
  }

  return estimateAssistantMessageHeight(message, containerWidth, isStreaming);
}
