import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag, stripErrorTags } from '@/lib/ai/errorTag';
import { measureTextBlockHeight } from '@/lib/text-layout';
import { getChatContentWidth } from './chatWidthBuckets';
import {
  BODY_FONT,
  BODY_LINE_HEIGHT,
} from './chatAssistantMarkdownTheme';
import {
  measureErrorHeight,
} from './chatAssistantMarkdownTypography';
import {
  extractThinkingSections,
  getParsedAssistantMarkdown,
} from './chatAssistantMarkdownParsing';
import { getMarkdownBlocksHeight } from './chatAssistantMarkdownBlocks';

const ASSISTANT_LEFT_PADDING = 15;
const ASSISTANT_TOOLBAR_HEIGHT = 30;
const ASSISTANT_IMAGE_HEIGHT = 220;
const ASSISTANT_IMAGE_GAP = 12;
const ASSISTANT_BLOCK_GAP = 20;
const ASSISTANT_THINKING_HEADER_HEIGHT = 28;
const ASSISTANT_THINKING_BODY_GAP = 8;
const ASSISTANT_THINKING_MARGIN_BOTTOM = 16;
const ASSISTANT_ERROR_MARGIN_TOP = 8;
const ASSISTANT_ERROR_MARGIN_BOTTOM = 8;

function estimateThinkingHeight(
  body: string,
  isComplete: boolean,
  contentWidth: number,
): number {
  if (!body) {
    return 0;
  }

  if (isComplete) {
    return ASSISTANT_THINKING_HEADER_HEIGHT;
  }

  const bodyHeight = measureTextBlockHeight(body, contentWidth, {
    font: BODY_FONT,
    lineHeight: BODY_LINE_HEIGHT,
    minHeight: BODY_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });

  return ASSISTANT_THINKING_HEADER_HEIGHT + ASSISTANT_THINKING_BODY_GAP + bodyHeight;
}

export function estimateAssistantMessageHeight(
  message: ChatMessage,
  containerWidth: number,
  isStreaming: boolean,
): number {
  const contentWidth = Math.max(1, getChatContentWidth(containerWidth) - ASSISTANT_LEFT_PADDING);
  const parsedError = parseErrorTag(message.content);
  const contentWithoutError = stripErrorTags(message.content);
  const thinking = extractThinkingSections(contentWithoutError);
  const parsedMarkdown = getParsedAssistantMarkdown(message, thinking.markdown);

  let height = 0;

  const thinkingHeight = estimateThinkingHeight(
    thinking.body,
    thinking.isComplete,
    contentWidth,
  );
  if (thinkingHeight > 0) {
    height += thinkingHeight;
    if (parsedMarkdown.blocks.length > 0 || parsedMarkdown.imageCount > 0 || parsedError?.content) {
      height += ASSISTANT_THINKING_MARGIN_BOTTOM;
    }
  }

  if (parsedMarkdown.blocks.length > 0) {
    height += getMarkdownBlocksHeight(parsedMarkdown, contentWidth);
    if (thinkingHeight > 0) {
      height += ASSISTANT_BLOCK_GAP;
    }
  }

  if (parsedMarkdown.imageCount > 0) {
    if (height > 0) {
      height += ASSISTANT_BLOCK_GAP;
    }
    height += parsedMarkdown.imageCount * ASSISTANT_IMAGE_HEIGHT
      + Math.max(0, parsedMarkdown.imageCount - 1) * ASSISTANT_IMAGE_GAP;
  }

  if (parsedError?.content) {
    if (height > 0) {
      height += ASSISTANT_ERROR_MARGIN_TOP;
    }
    height += measureErrorHeight(parsedError.content, contentWidth) + ASSISTANT_ERROR_MARGIN_BOTTOM;
  }

  if (!isStreaming) {
    height += ASSISTANT_TOOLBAR_HEIGHT;
  }

  return Math.max(height, BODY_LINE_HEIGHT);
}

export function estimateChatLoadingHeight(): number {
  return 24;
}
