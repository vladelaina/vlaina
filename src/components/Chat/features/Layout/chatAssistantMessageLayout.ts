import type { ChatMessage } from '@/lib/ai/types';
import { parseErrorTag, stripErrorTags } from '@/lib/ai/errorTag';
import { measureTextBlockHeight } from '@/lib/text-layout';
import {
  MARKDOWN_BODY_FONT,
  MARKDOWN_BODY_LINE_HEIGHT,
  MARKDOWN_BLOCK_GAP,
} from '@/components/common/markdown/markdownMetrics';
import { getChatContentWidth } from './chatWidthBuckets';
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
const ASSISTANT_THINKING_HEADER_HEIGHT = 28;
const ASSISTANT_THINKING_BODY_GAP = 8;
const ASSISTANT_THINKING_MARGIN_BOTTOM = 16;
const ASSISTANT_ERROR_MARGIN_TOP = 8;
const ASSISTANT_ERROR_MARGIN_BOTTOM = 8;
const MAX_ASSISTANT_ESTIMATE_PARSE_CHARS = 1800;
const ASSISTANT_LONG_TEXT_CHARS_PER_LINE = 78;
const ASSISTANT_LONG_TEXT_EXTRA_LINE_HEIGHT = 0.78;

function clampAssistantEstimateContent(content: string, isStreaming: boolean): string {
  if (isStreaming || content.length <= MAX_ASSISTANT_ESTIMATE_PARSE_CHARS) {
    return content;
  }

  return content.slice(0, MAX_ASSISTANT_ESTIMATE_PARSE_CHARS);
}

function estimateAssistantRemainderHeight(content: string, isStreaming: boolean): number {
  if (isStreaming || content.length <= MAX_ASSISTANT_ESTIMATE_PARSE_CHARS) {
    return 0;
  }

  const remainingChars = content.length - MAX_ASSISTANT_ESTIMATE_PARSE_CHARS;
  return Math.ceil(remainingChars / ASSISTANT_LONG_TEXT_CHARS_PER_LINE)
    * MARKDOWN_BODY_LINE_HEIGHT
    * ASSISTANT_LONG_TEXT_EXTRA_LINE_HEIGHT;
}

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
    font: MARKDOWN_BODY_FONT,
    lineHeight: MARKDOWN_BODY_LINE_HEIGHT,
    minHeight: MARKDOWN_BODY_LINE_HEIGHT,
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
  const estimateContent = clampAssistantEstimateContent(message.content, isStreaming);
  const estimateMessage = estimateContent === message.content
    ? message
    : {
        ...message,
        id: `${message.id}:height-estimate:${estimateContent.length}`,
        content: estimateContent,
      };
  const parsedError = parseErrorTag(estimateContent);
  const contentWithoutError = stripErrorTags(estimateContent);
  const thinking = extractThinkingSections(contentWithoutError);
  const parsedMarkdown = getParsedAssistantMarkdown(estimateMessage, thinking.markdown);

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
      height += MARKDOWN_BLOCK_GAP;
    }
  }

  if (parsedMarkdown.imageCount > 0) {
    if (height > 0) {
      height += MARKDOWN_BLOCK_GAP;
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

  return Math.max(height + estimateAssistantRemainderHeight(message.content, isStreaming), MARKDOWN_BODY_LINE_HEIGHT);
}

export function estimateChatLoadingHeight(): number {
  return 24;
}
