import type { ApiTranscriptMessage, ChatMessage, ChatMessageContent } from './types';
import { TIME_SYSTEM_PROMPT, IMAGE_PLACEHOLDER } from './prompts';
import { extractWebSearchStatuses } from './webSearch/statusMarkup';
import { stripThinkingContent } from './stripThinkingContent';
import {
  parseMarkdownAndHtmlImageTokens,
  replaceImageTokens,
  type ImageToken,
} from '@/lib/markdown/markdownImageTokens';
import { parseHtmlImageSrcTokenFromTag } from '@/lib/markdown/markdownHtmlImageSrc';
import {
  getInlineCodeRanges,
  findHtmlTagEnd,
  iterateNonFencedContentRanges,
  getRangeEndAtOffset,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  type ContentRange,
} from '@/lib/markdown/markdownRanges';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { normalizeApiTranscriptMessages } from './apiTranscript';

const ERROR_TAG_GLOBAL_REGEX = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/gi;
const REQUEST_HISTORY_MESSAGE_OVERHEAD = 48;
const MAX_REQUEST_HISTORY_MESSAGES = 32;
const MAX_REQUEST_HISTORY_CHARS = 24000;
const MAX_REQUEST_MESSAGE_CHARS = 6000;
export const MAX_CURRENT_REQUEST_MESSAGE_CHARS = 160_000;
const MAX_TRANSCRIPT_FIELD_CHARS = 1200;
const MAX_REQUEST_JSON_DEPTH = 8;
const MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS = 4096;
const MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS = 1024 * 1024;
const MAX_REQUEST_HISTORY_IMAGE_TOTAL_LABEL_SCAN_CHARS = 4 * MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS;
const MAX_REQUEST_HISTORY_IMAGE_TOKENS = 2000;
const MAX_REQUEST_HISTORY_HTML_IMAGE_TAG_END_SCAN_CHARS = 64 * 1024;
const MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS = 4000;
const MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES = 4000;
const CONTENT_TRUNCATION_MARKER = '\n[Earlier content omitted]\n';
const HISTORY_IMAGE_SOURCE_PREFIXES = [
  'data:image/',
  'attachment://',
  'app-file://',
  'file://',
];
const HISTORY_IMAGE_SOURCE_HINT_PATTERN = /\b(?:data|attachment|app-file|file)(?::|&|&#)/i;

export function formatTimeByOffset(offset: number, now = new Date()): string {
  const utcMs = now.getTime();
  const totalOffsetMinutes = Math.round(offset * 60);
  const targetMs = utcMs + totalOffsetMinutes * 60 * 1000;
  const targetDate = new Date(targetMs);

  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getUTCDate()).padStart(2, '0');
  const hours = String(targetDate.getUTCHours()).padStart(2, '0');
  const minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(targetDate.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map(sanitizeHistoryMessage)
    .filter((msg) => msg.role !== 'assistant' || msg.content.trim().length > 0);
}

function shouldReplaceHistoryImageToken(token: ImageToken): boolean {
  return !token.src || !parseVideoUrl(token.src);
}

function countNeedleOccurrences(content: string, needle: string, limit: number): number {
  let count = 0;
  let cursor = 0;
  while (count <= limit) {
    const index = content.indexOf(needle, cursor);
    if (index === -1) return count;
    count += 1;
    cursor = index + needle.length;
  }
  return count;
}

function scrubOverflowHistoryHtmlImages(content: string): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowHistoryHtmlImagesInRange(content, range);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowHistoryHtmlImagesInRange(content: string, range: ContentRange): string {
  const inlineCodeRanges = getInlineCodeRanges(
    content,
    range,
    MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = '';
  let cursor = range.start;

  while (cursor < range.end) {
    const start = indexOfAsciiCaseInsensitive(content, '<img', cursor);
    if (start === -1 || start >= range.end) {
      output += content.slice(cursor, range.end);
      break;
    }

    const inlineCodeEnd = getRangeEndAtOffset(start, inlineCodeRanges);
    if (inlineCodeEnd !== null) {
      output += content.slice(cursor, inlineCodeEnd);
      cursor = inlineCodeEnd;
      continue;
    }

    const tagEnd = findHtmlTagEnd(
      content,
      start,
      Math.min(range.end, start + MAX_REQUEST_HISTORY_HTML_IMAGE_TAG_END_SCAN_CHARS + 1),
    );
    const isUnboundedImageTag =
      tagEnd === -1 || tagEnd > range.end || tagEnd - start > MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS;
    if (isUnboundedImageTag) {
      const scrubEnd = tagEnd === -1
        ? getOverflowHistoryMarkdownImageScrubEnd(content, start + 4, range.end)
        : tagEnd;
      output += content.slice(cursor, start);
      output += IMAGE_PLACEHOLDER;
      cursor = scrubEnd;
      continue;
    }

    const tag = content.slice(start, tagEnd);
    const src = parseHtmlImageSrcTokenFromTag(tag)?.src;
    if (!src || !isHistoryImageSource(src)) {
      output += content.slice(cursor, tagEnd);
      cursor = tagEnd;
      continue;
    }

    output += content.slice(cursor, start);
    output += IMAGE_PLACEHOLDER;
    cursor = tagEnd;
  }

  return output;
}

function scrubOverflowHistoryMarkdownImages(content: string): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowHistoryMarkdownImagesInRange(content, range);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowHistoryMarkdownImagesInRange(content: string, range: ContentRange): string {
  const inlineCodeRanges = getInlineCodeRanges(
    content,
    range,
    MAX_REQUEST_HISTORY_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = '';
  let cursor = range.start;
  let remainingLabelScanChars = MAX_REQUEST_HISTORY_IMAGE_TOTAL_LABEL_SCAN_CHARS;

  while (cursor < range.end) {
    const start = content.indexOf('![', cursor);
    if (start === -1 || start >= range.end) {
      output += content.slice(cursor, range.end);
      break;
    }

    if (isOffsetInRanges(start, inlineCodeRanges)) {
      const inlineCodeEnd = getRangeEndAtOffset(start, inlineCodeRanges) ?? start + 2;
      output += content.slice(cursor, inlineCodeEnd);
      cursor = inlineCodeEnd;
      continue;
    }

    if (isEscapedMarkdownPunctuation(content, start, range.start)) {
      output += content.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const labelResult = findHistoryMarkdownImageLabelEnd(
      content,
      start,
      range.end,
      remainingLabelScanChars,
    );
    remainingLabelScanChars = labelResult.remainingScanChars;
    if (labelResult.exhausted) {
      output += content.slice(cursor, start);
      output += IMAGE_PLACEHOLDER;
      cursor = range.end;
      break;
    }

    const labelEnd = labelResult.labelEnd;
    if (labelEnd === null) {
      output += content.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const targetEnd = content.indexOf(')', labelEnd + 2);
    if (
      targetEnd === -1 ||
      targetEnd >= range.end ||
      targetEnd - labelEnd > MAX_REQUEST_HISTORY_IMAGE_TARGET_CHARS
    ) {
      if (isHistoryMarkdownImageTargetAt(content, labelEnd + 2)) {
        const scrubEnd = targetEnd !== -1 && targetEnd < range.end
          ? targetEnd + 1
          : getOverflowHistoryMarkdownImageScrubEnd(content, labelEnd + 2, range.end);
        output += content.slice(cursor, start);
        output += IMAGE_PLACEHOLDER;
        cursor = scrubEnd;
      } else {
        output += content.slice(cursor, start + 2);
        cursor = start + 2;
      }
      continue;
    }

    output += content.slice(cursor, start);
    output += IMAGE_PLACEHOLDER;
    cursor = targetEnd + 1;
  }

  return output;
}

function findHistoryMarkdownImageLabelEnd(
  content: string,
  start: number,
  rangeEnd: number,
  remainingScanChars: number,
): { exhausted: boolean; labelEnd: number | null; remainingScanChars: number } {
  const labelStart = start + 2;
  const scanEnd = Math.min(rangeEnd, labelStart + MAX_REQUEST_HISTORY_IMAGE_LABEL_SCAN_CHARS);
  const labelEnd = indexOfHistoryMarkdownImageLabelClose(content, labelStart, scanEnd);
  const boundedLabelEnd = labelEnd === -1 ? null : labelEnd;
  const scannedEnd = boundedLabelEnd === null ? scanEnd : boundedLabelEnd + 2;
  const nextRemainingScanChars = remainingScanChars - Math.max(0, scannedEnd - labelStart);

  return {
    exhausted: nextRemainingScanChars < 0,
    labelEnd: boundedLabelEnd,
    remainingScanChars: Math.max(0, nextRemainingScanChars),
  };
}

function indexOfHistoryMarkdownImageLabelClose(content: string, start: number, end: number): number {
  for (let index = start; index + 1 < end; index += 1) {
    if (content[index] === ']' && content[index + 1] === '(') {
      return index;
    }
  }
  return -1;
}

function isHistoryMarkdownImageTargetAt(content: string, targetStart: number): boolean {
  let cursor = targetStart;
  while (cursor < content.length && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  if (content[cursor] === '<') {
    cursor += 1;
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
  }
  return isHistoryImageSource(content.slice(cursor, cursor + 128));
}

function getOverflowHistoryMarkdownImageScrubEnd(content: string, targetStart: number, rangeEnd: number): number {
  const lineFeed = content.indexOf('\n', targetStart);
  const carriageReturn = content.indexOf('\r', targetStart);
  return Math.min(
    lineFeed === -1 ? rangeEnd : lineFeed,
    carriageReturn === -1 ? rangeEnd : carriageReturn,
    rangeEnd,
  );
}

function isHistoryImageSource(value: string): boolean {
  const decoded = decodeMarkdownHtmlText(value).trimStart();
  return HISTORY_IMAGE_SOURCE_PREFIXES.some((prefix) =>
    hasAsciiCaseInsensitiveAt(decoded, prefix, 0)
  );
}

function hasAsciiCaseInsensitiveAt(content: string, needle: string, start: number): boolean {
  if (start < 0 || start + needle.length > content.length) {
    return false;
  }
  for (let offset = 0; offset < needle.length; offset += 1) {
    if (content[start + offset]?.toLowerCase() !== needle[offset]) {
      return false;
    }
  }
  return true;
}

function indexOfAsciiCaseInsensitive(value: string, needle: string, fromIndex: number): number {
  const maxStart = value.length - needle.length;
  for (let index = Math.max(0, fromIndex); index <= maxStart; index += 1) {
    if (hasAsciiCaseInsensitiveAt(value, needle, index)) {
      return index;
    }
  }
  return -1;
}

function scrubOverflowHistoryImageSyntax(content: string): string {
  return scrubOverflowHistoryMarkdownImages(scrubOverflowHistoryHtmlImages(content));
}

function replaceHistoryImageTokens(content: string): string {
  const tokens = parseMarkdownAndHtmlImageTokens(content, {
    maxTokens: MAX_REQUEST_HISTORY_IMAGE_TOKENS,
  }).filter(shouldReplaceHistoryImageToken);
  const replaced = replaceImageTokens(content, tokens, IMAGE_PLACEHOLDER);
  if (
    tokens.length >= MAX_REQUEST_HISTORY_IMAGE_TOKENS ||
    HISTORY_IMAGE_SOURCE_HINT_PATTERN.test(replaced) ||
    countNeedleOccurrences(content, '![', MAX_REQUEST_HISTORY_IMAGE_TOKENS) > MAX_REQUEST_HISTORY_IMAGE_TOKENS ||
    countNeedleOccurrences(content, '<', MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS) > MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS
  ) {
    return scrubOverflowHistoryImageSyntax(replaced);
  }
  return replaced;
}

export function sanitizeRequestTextImageReferences(content: string): string {
  return replaceHistoryImageTokens(content);
}

export function sanitizeCurrentRequestTextContent(
  content: string,
  maxChars = MAX_CURRENT_REQUEST_MESSAGE_CHARS
): string {
  return clipContentToBudget(sanitizeRequestTextImageReferences(content), maxChars);
}

function getHistoryContentText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return '';
      }

      const record = part as Record<string, unknown>;
      if (record.type === 'text' && typeof record.text === 'string') {
        return record.text;
      }

      if (record.type === 'image_url') {
        return IMAGE_PLACEHOLDER;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function sanitizeHistoryMessage(msg: ChatMessage): ChatMessage {
  const rawContent = getHistoryContentText((msg as { content?: unknown }).content);
  const contentWithoutUiErrors = msg.role === 'assistant'
    ? rawContent.replace(ERROR_TAG_GLOBAL_REGEX, '').trim()
    : rawContent;
  const apiTranscript = normalizeApiTranscriptMessages(
    msg.apiTranscript ?? msg.versions?.[msg.currentVersionIndex]?.apiTranscript
  );

  return {
    ...msg,
    content: extractWebSearchStatuses(
      replaceHistoryImageTokens(stripThinkingContent(contentWithoutUiErrors))
    ).content,
    apiTranscript,
    versions: stripVersionApiTranscripts(msg.versions),
  };
}

function stripVersionApiTranscripts(versions: ChatMessage['versions']): ChatMessage['versions'] {
  if (!Array.isArray(versions)) {
    return [];
  }

  return versions.map((version) => {
    const { apiTranscript: _apiTranscript, subsequentMessages, ...rest } = version;
    return {
      ...rest,
      subsequentMessages: stripMessageApiTranscripts(subsequentMessages),
    };
  });
}

function stripMessageApiTranscripts(messages: ChatMessage[] | undefined): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => {
    const { apiTranscript: _apiTranscript, ...rest } = message;
    return {
      ...rest,
      versions: stripVersionApiTranscripts(message.versions),
    };
  });
}

function createSystemMessage(content: string, modelId: string): ChatMessage {
  const now = Date.now();
  return {
    role: 'system',
    content,
    modelId,
    id: `sys-${crypto.randomUUID()}`,
    timestamp: now,
    versions: [{ content, createdAt: now, kind: 'original', subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

function clipContentToBudget(content: string, maxChars: number): string {
  if (maxChars <= 0) {
    return '';
  }

  if (content.length <= maxChars) {
    return content;
  }

  if (maxChars <= CONTENT_TRUNCATION_MARKER.length + 16) {
    return content.slice(-maxChars);
  }

  const availableChars = maxChars - CONTENT_TRUNCATION_MARKER.length;
  const prefixChars = Math.ceil(availableChars * 0.6);
  const suffixChars = Math.max(availableChars - prefixChars, 0);
  const suffix = suffixChars > 0 ? content.slice(-suffixChars) : '';
  return `${content.slice(0, prefixChars)}${CONTENT_TRUNCATION_MARKER}${suffix}`;
}

function clipTranscriptContent(content: ChatMessageContent | null | undefined): ChatMessageContent | null | undefined {
  if (typeof content !== 'string') {
    return content;
  }

  return clipContentToBudget(content, MAX_TRANSCRIPT_FIELD_CHARS);
}

function compactTranscriptMessage(message: ApiTranscriptMessage): ApiTranscriptMessage {
  const content = clipTranscriptContent(message.content);
  return {
    ...message,
    content: message.role === 'assistant' && content == null && (message.reasoning_content || message.tool_calls?.length)
      ? ''
      : content,
    ...(typeof message.reasoning_content === 'string'
      ? { reasoning_content: clipContentToBudget(message.reasoning_content, MAX_TRANSCRIPT_FIELD_CHARS) }
      : {}),
  };
}

function measureJsonStringLength(value: string, maxChars: number): number {
  if (maxChars <= 0) {
    return 1;
  }

  let length = 2;
  if (length > maxChars) {
    return maxChars + 1;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) {
      length += 2;
    } else if (code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d) {
      length += 2;
    } else if (code < 0x20) {
      length += 6;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        length += 2;
        index += 1;
      } else {
        length += 6;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      length += 6;
    } else {
      length += 1;
    }

    if (length > maxChars) {
      return maxChars + 1;
    }
  }

  return length;
}

function measureJsonLength(value: unknown, maxChars: number, depth = 0): number {
  if (maxChars <= 0) {
    return 1;
  }

  if (value === null) {
    return 4;
  }

  switch (typeof value) {
    case 'string':
      return measureJsonStringLength(value, maxChars);
    case 'number':
      return Number.isFinite(value) ? String(value).length : 4;
    case 'boolean':
      return value ? 4 : 5;
    case 'object':
      break;
    default:
      return maxChars + 1;
  }

  if (depth >= MAX_REQUEST_JSON_DEPTH) {
    return maxChars + 1;
  }

  if (Array.isArray(value)) {
    let length = 1;
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) {
        length += 1;
      }

      const item = value[index];
      length += item === undefined || typeof item === 'function' || typeof item === 'symbol'
        ? 4
        : measureJsonLength(item, maxChars - length, depth + 1);
      if (length > maxChars) {
        return maxChars + 1;
      }
    }
    return length + 1;
  }

  let length = 1;
  let hasEntry = false;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const field = record[key];
    if (field === undefined || typeof field === 'function' || typeof field === 'symbol') {
      continue;
    }

    if (hasEntry) {
      length += 1;
    }
    hasEntry = true;
    length += measureJsonStringLength(key, maxChars - length) + 1;
    if (length > maxChars) {
      return maxChars + 1;
    }

    length += measureJsonLength(field, maxChars - length, depth + 1);
    if (length > maxChars) {
      return maxChars + 1;
    }
  }
  return length + 1;
}

export function measureRequestJsonLength(value: unknown, maxChars: number): number {
  if (maxChars <= 0) {
    return 1;
  }

  return measureJsonLength(value, maxChars);
}

function compactApiTranscriptToBudget(
  transcript: ApiTranscriptMessage[],
  maxChars: number
): ApiTranscriptMessage[] | undefined {
  if (measureRequestJsonLength(transcript, maxChars) <= maxChars) {
    return transcript;
  }

  const compacted = transcript.map(compactTranscriptMessage);
  if (measureRequestJsonLength(compacted, maxChars) <= maxChars) {
    return compacted;
  }

  const finalAssistant = [...compacted].reverse().find((message) =>
    message.role === 'assistant' && (message.content != null || message.reasoning_content)
  );
  if (!finalAssistant) {
    return undefined;
  }

  const minimal: ApiTranscriptMessage = {
    role: 'assistant',
    content: clipTranscriptContent(finalAssistant.content) ?? '',
    ...(finalAssistant.reasoning_content
      ? { reasoning_content: clipContentToBudget(finalAssistant.reasoning_content, MAX_TRANSCRIPT_FIELD_CHARS) }
      : {}),
  };

  return measureRequestJsonLength([minimal], maxChars) <= maxChars ? [minimal] : undefined;
}

function clipTranscriptToBudget<T extends ChatMessage>(message: T, maxChars: number): T {
  if (!message.apiTranscript) {
    return message;
  }

  const apiTranscript = compactApiTranscriptToBudget(message.apiTranscript, maxChars);
  if (apiTranscript) {
    return {
      ...message,
      apiTranscript,
    };
  }

  const { apiTranscript: _apiTranscript, ...rest } = message;
  return rest as T;
}

function estimateHistorySize(messages: ChatMessage[], maxChars: number): number {
  let total = 0;
  for (const message of messages) {
    total += message.content.length + REQUEST_HISTORY_MESSAGE_OVERHEAD;
    if (message.apiTranscript) {
      total += measureRequestJsonLength(message.apiTranscript, maxChars - total);
    }

    if (total > maxChars) {
      return maxChars + 1;
    }
  }
  return total;
}

function trimHistoryToBudget(history: ChatMessage[], maxChars: number): ChatMessage[] {
  if (maxChars <= 0 || history.length === 0) {
    return [];
  }

  const boundedHistory: ChatMessage[] = [];
  for (let index = history.length - 1; index >= 0 && boundedHistory.length < MAX_REQUEST_HISTORY_MESSAGES; index -= 1) {
    const message = sanitizeHistoryMessage(history[index]);
    if (message.role === 'assistant' && message.content.trim().length === 0) {
      continue;
    }
    boundedHistory.unshift(message);
  }

  const clippedHistory = boundedHistory
    .map((message) => ({
      ...message,
      content: clipContentToBudget(message.content, MAX_REQUEST_MESSAGE_CHARS),
    }))
    .map((message) => clipTranscriptToBudget(message, MAX_REQUEST_MESSAGE_CHARS));

  while (clippedHistory.length > 1 && estimateHistorySize(clippedHistory, maxChars) > maxChars) {
    clippedHistory.shift();
  }

  if (estimateHistorySize(clippedHistory, maxChars) <= maxChars) {
    return clippedHistory;
  }

  const [latestMessage] = clippedHistory;
  const availableChars = Math.max(maxChars - REQUEST_HISTORY_MESSAGE_OVERHEAD, 0);
  const trimmedLatestContent = clipContentToBudget(latestMessage.content, availableChars);

  if (!trimmedLatestContent) {
    return [];
  }

  return [
    clipTranscriptToBudget({
      ...latestMessage,
      content: trimmedLatestContent,
    }, availableChars),
  ];
}

interface BuildRequestHistoryOptions {
  history: ChatMessage[];
  modelId: string;
  timezoneOffset: number;
  includeTimeContext: boolean;
  customSystemPrompt?: string;
}

export function buildRequestHistory(options: BuildRequestHistoryOptions): ChatMessage[] {
  const { history, modelId, timezoneOffset, includeTimeContext, customSystemPrompt } = options;
  const systemParts: string[] = [];
  const prompt = customSystemPrompt?.trim();

  if (prompt) {
    systemParts.push(prompt);
  }

  if (includeTimeContext) {
    const timeInfo = formatTimeByOffset(timezoneOffset);
    systemParts.push(TIME_SYSTEM_PROMPT(timeInfo));
  }

  if (systemParts.length === 0) {
    return trimHistoryToBudget(history, MAX_REQUEST_HISTORY_CHARS);
  }

  const mergedSystemMessage = createSystemMessage(
    clipContentToBudget(
      systemParts.join('\n\n'),
      Math.max(MAX_REQUEST_HISTORY_CHARS - REQUEST_HISTORY_MESSAGE_OVERHEAD, 0)
    ),
    modelId
  );
  const availableHistoryChars = Math.max(
    MAX_REQUEST_HISTORY_CHARS - mergedSystemMessage.content.length - REQUEST_HISTORY_MESSAGE_OVERHEAD,
    0
  );
  return [mergedSystemMessage, ...trimHistoryToBudget(history, availableHistoryChars)];
}
