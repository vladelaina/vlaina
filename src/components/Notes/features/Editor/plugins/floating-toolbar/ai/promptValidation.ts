const NON_ENGLISH_SCRIPT_PATTERN =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/u;

function hasNonEnglishScript(text: string): boolean {
  return NON_ENGLISH_SCRIPT_PATTERN.test(text);
}

export function isEnglishPromptText(text: string): boolean {
  return !hasNonEnglishScript(text);
}

export function assertEnglishPromptText(context: string, text: string): void {
  if (isEnglishPromptText(text)) {
    return;
  }

  throw new Error(`[AI Prompt] ${context} must be English-only.`);
}
