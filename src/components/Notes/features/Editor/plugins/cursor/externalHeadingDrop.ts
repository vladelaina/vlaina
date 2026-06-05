const MAX_HEADING_DROP_HTML_CHARS = 64 * 1024;
const MAX_HEADING_DROP_TEXT_CHARS = 2_000;

export interface HeadingDropPayload {
  level: number;
  text: string;
}

export function parseSingleHeadingDropHtml(html: string): HeadingDropPayload | null {
  if (!html || html.length > MAX_HEADING_DROP_HTML_CHARS) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headings = Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  if (headings.length !== 1) return null;

  const heading = headings[0];
  const text = heading.textContent?.trim();
  if (!text || text.length > MAX_HEADING_DROP_TEXT_CHARS) return null;
  if ((doc.body.textContent ?? '').trim() !== text) return null;

  const level = Number(heading.tagName.slice(1));
  if (!Number.isInteger(level) || level < 1 || level > 6) return null;

  return { level, text };
}
