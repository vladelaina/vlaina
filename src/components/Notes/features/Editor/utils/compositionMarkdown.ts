export function hasCommittedCompositionText(
  markdown: string | null,
  latestCompositionData: string | null,
  baseContent: string,
  replacedText: string | null = null,
  residueText: string | null = null,
): markdown is string {
  if (markdown === null) {
    return false;
  }

  if (!latestCompositionData) {
    return true;
  }

  const countOccurrences = (content: string) => content.split(latestCompositionData).length - 1;
  if (countOccurrences(markdown) > countOccurrences(baseContent)) {
    return true;
  }

  if (!markdown.includes(latestCompositionData) || !replacedText || !residueText) {
    return false;
  }

  const countText = (content: string, text: string) => content.split(text).length - 1;
  return countText(markdown, replacedText) < countText(baseContent, replacedText) &&
    countText(markdown, residueText) <= countText(baseContent, residueText);
}
