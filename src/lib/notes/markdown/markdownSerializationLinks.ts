import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import {
  MAILTO_EMAIL_MARKDOWN_LINK_PATTERN
} from './markdownSerializationShared';

export function normalizeMailtoEmailMarkdownLinks(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(
      MAILTO_EMAIL_MARKDOWN_LINK_PATTERN,
      (match, prefix: string, label: string, destination: string) =>
        label.toLowerCase() === destination.toLowerCase() ? `${prefix}${label}` : match
    )
  );
}
