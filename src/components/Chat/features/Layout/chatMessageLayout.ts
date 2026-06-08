import type { ChatMessage } from '@/lib/ai/types';
import { measureTextBlockHeight } from '@/lib/text-layout';
import {
  MARKDOWN_BODY_FONT,
  MARKDOWN_BODY_LINE_HEIGHT,
} from '@/components/common/markdown/markdownMetrics';
import { getChatContentWidth, normalizeChatContainerWidth } from './chatWidthBuckets';
import {
  estimateAssistantMessageHeight,
  estimateChatLoadingHeight,
} from './chatAssistantMessageLayout';
import {
  extractRenderedMarkdownImageSources,
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  stripMarkdownImageTokens,
} from '@/components/Chat/common/messageClipboard';

const USER_BUBBLE_MAX_RATIO = 0.9;
const USER_BUBBLE_PADDING_X = 32;
const USER_BUBBLE_PADDING_Y = 12;
const USER_IMAGE_HEIGHT = 256;
const USER_STACK_GAP = 8;
const USER_TOOLBAR_HEIGHT = 30;

type EstimatedChatMessageHeightOptions = {
  containerWidth: number;
  isStreaming: boolean;
};

const MAX_ESTIMATED_TEXT_SCAN_CHARS = 1600;
const APPROXIMATE_LONG_TEXT_CHARS_PER_LINE = 72;
const APPROXIMATE_LONG_TEXT_EXTRA_LINE_HEIGHT = 0.78;

function clampEstimatedText(content: string): string {
  if (content.length <= MAX_ESTIMATED_TEXT_SCAN_CHARS) {
    return content;
  }

  return content.slice(0, MAX_ESTIMATED_TEXT_SCAN_CHARS);
}

function estimateLongTextRemainderHeight(content: string): number {
  if (content.length <= MAX_ESTIMATED_TEXT_SCAN_CHARS) {
    return 0;
  }

  const remainingChars = content.length - MAX_ESTIMATED_TEXT_SCAN_CHARS;
  return Math.ceil(remainingChars / APPROXIMATE_LONG_TEXT_CHARS_PER_LINE)
    * MARKDOWN_BODY_LINE_HEIGHT
    * APPROXIMATE_LONG_TEXT_EXTRA_LINE_HEIGHT;
}

function countRenderableImages(content: string): number {
  return extractRenderedMarkdownImageSources(clampEstimatedText(content), {
    maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  }).length;
}

function estimateUserMessageHeight(
  message: ChatMessage,
  containerWidth: number,
  isStreaming: boolean,
): number {
  const contentWidth = getChatContentWidth(containerWidth);
  const bubbleWidth = Math.max(120, Math.floor(contentWidth * USER_BUBBLE_MAX_RATIO));
  const textWidth = Math.max(1, bubbleWidth - USER_BUBBLE_PADDING_X);
  const text = stripMarkdownImageTokens(clampEstimatedText(message.content), {
    maxTokens: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES,
  }).trim();
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
      font: MARKDOWN_BODY_FONT,
      lineHeight: MARKDOWN_BODY_LINE_HEIGHT,
      minHeight: MARKDOWN_BODY_LINE_HEIGHT,
      prepareOptions: { whiteSpace: 'pre-wrap' },
    }) + estimateLongTextRemainderHeight(message.content) + USER_BUBBLE_PADDING_Y;
  }

  if (height === 0) {
    height = MARKDOWN_BODY_LINE_HEIGHT + USER_BUBBLE_PADDING_Y;
  }

  return height + (isStreaming ? 0 : USER_TOOLBAR_HEIGHT);
}

export { estimateChatLoadingHeight };

export function estimateChatMessageHeight(
  message: ChatMessage,
  { containerWidth, isStreaming }: EstimatedChatMessageHeightOptions,
): number {
  const normalizedWidth = normalizeChatContainerWidth(containerWidth);
  if (message.role === 'user') {
    return estimateUserMessageHeight(message, normalizedWidth, isStreaming);
  }

  return estimateAssistantMessageHeight(message, normalizedWidth, isStreaming);
}
