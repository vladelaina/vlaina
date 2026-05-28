export function hasCommittedCompositionText(
  markdown: string | null,
  latestCompositionData: string | null,
): markdown is string {
  if (markdown === null) {
    return false;
  }

  return !latestCompositionData || markdown.includes(latestCompositionData);
}
