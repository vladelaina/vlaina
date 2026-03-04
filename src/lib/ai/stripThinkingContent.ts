const THINKING_TAG_REGEX = /<think>[\s\S]*?(?:<\/think>|$)/gi;

export function stripThinkingContent(content: string): string {
  return content.replace(THINKING_TAG_REGEX, '').trim();
}
