import type { ChatMessage } from './types';
import { TIME_SYSTEM_PROMPT, IMAGE_PLACEHOLDER } from './prompts';

const IMAGE_MARKDOWN_REGEX = /!\[.*?\]\(.*?\)/g;
const REQUEST_HISTORY_MESSAGE_OVERHEAD = 48;
const MAX_REQUEST_HISTORY_MESSAGES = 32;
const MAX_REQUEST_HISTORY_CHARS = 24000;
const MAX_REQUEST_MESSAGE_CHARS = 6000;
const CONTENT_TRUNCATION_MARKER = '\n[Earlier content omitted]\n';

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
  return messages.map((msg) => {
    if (typeof msg.content !== 'string') return msg;
    return {
      ...msg,
      content: msg.content.replace(IMAGE_MARKDOWN_REGEX, IMAGE_PLACEHOLDER),
    };
  });
}

function createSystemMessage(content: string, modelId: string): ChatMessage {
  return {
    role: 'system',
    content,
    modelId,
    id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now(),
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

function estimateHistorySize(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) => total + message.content.length + REQUEST_HISTORY_MESSAGE_OVERHEAD,
    0
  );
}

function trimHistoryToBudget(history: ChatMessage[], maxChars: number): ChatMessage[] {
  if (maxChars <= 0 || history.length === 0) {
    return [];
  }

  const boundedHistory = sanitizeHistory(history)
    .map((message) => ({
      ...message,
      content: clipContentToBudget(message.content, MAX_REQUEST_MESSAGE_CHARS),
    }))
    .slice(-MAX_REQUEST_HISTORY_MESSAGES);

  while (boundedHistory.length > 1 && estimateHistorySize(boundedHistory) > maxChars) {
    boundedHistory.shift();
  }

  if (estimateHistorySize(boundedHistory) <= maxChars) {
    return boundedHistory;
  }

  const [latestMessage] = boundedHistory;
  const availableChars = Math.max(maxChars - REQUEST_HISTORY_MESSAGE_OVERHEAD, 0);
  const trimmedLatestContent = clipContentToBudget(latestMessage.content, availableChars);

  if (!trimmedLatestContent) {
    return [];
  }

  return [
    {
      ...latestMessage,
      content: trimmedLatestContent,
    },
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

  const mergedSystemMessage = createSystemMessage(systemParts.join('\n\n'), modelId);
  const availableHistoryChars = Math.max(
    MAX_REQUEST_HISTORY_CHARS - mergedSystemMessage.content.length - REQUEST_HISTORY_MESSAGE_OVERHEAD,
    0
  );
  return [mergedSystemMessage, ...trimHistoryToBudget(history, availableHistoryChars)];
}
