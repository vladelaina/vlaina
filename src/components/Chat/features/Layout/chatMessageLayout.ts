import type { ChatMessage } from '@/lib/ai/types';
import { measureTextBlockHeight } from '@/lib/text-layout';
import { getChatContentWidth, normalizeChatContainerWidth } from './chatWidthBuckets';
import {
  estimateAssistantMessageHeight,
  estimateChatLoadingHeight,
} from './chatAssistantMessageLayout';
import {
  BODY_FONT,
  BODY_LINE_HEIGHT,
} from './chatAssistantMarkdownTheme';

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

function stripRenderableImageTokens(content: string): string {
  return content
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/<img\b[^>]*>/gi, '');
}

function countRenderableImages(content: string): number {
  const markdownImageMatches = content.match(/!\[[^\]]*\]\(([^)]+)\)/g) || [];
  const htmlImageMatches = content.match(/<img\b[^>]*>/gi) || [];
  return markdownImageMatches.length + htmlImageMatches.length;
}

function estimateUserMessageHeight(
  message: ChatMessage,
  containerWidth: number,
  isStreaming: boolean,
): number {
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
