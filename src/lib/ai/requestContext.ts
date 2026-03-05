import type { ChatMessage } from './types';
import { TIME_SYSTEM_PROMPT, IMAGE_PLACEHOLDER } from './prompts';

const IMAGE_MARKDOWN_REGEX = /!\[.*?\]\(.*?\)/g;

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

  const sign = totalOffsetMinutes >= 0 ? '+' : '-';
  const absoluteOffsetMinutes = Math.abs(totalOffsetMinutes);
  const offsetHours = Math.floor(absoluteOffsetMinutes / 60);
  const offsetMinutes = absoluteOffsetMinutes % 60;
  const offsetText = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} GMT${offsetText}`;
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
    return sanitizeHistory(history);
  }

  const mergedSystemMessage = createSystemMessage(systemParts.join('\n\n'), modelId);
  return [mergedSystemMessage, ...sanitizeHistory(history)];
}
