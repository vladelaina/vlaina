export interface ParsedErrorTag {
  type?: string;
  code?: string;
  content: string;
}

const ERROR_TAG_REGEX = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/i;
const ERROR_TAG_GLOBAL_REGEX = /<error(?: type="([^"]*)")?(?: code="([^"]*)")?>([\s\S]*?)<\/error>/gi;

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

export function buildErrorTag(type: string | undefined, code: string | number | undefined, detail: string): string {
  const safeType = escapeXmlAttribute(type || 'UNKNOWN');
  const safeCode = escapeXmlAttribute(code === undefined || code === null ? '' : String(code));
  const safeDetail = escapeXmlText(detail);
  return `<error type="${safeType}" code="${safeCode}">${safeDetail}</error>`;
}

export function parseErrorTag(content: string): ParsedErrorTag | null {
  const match = ERROR_TAG_REGEX.exec(content);
  if (!match) {
    return null;
  }

  return {
    type: match[1] ? decodeXmlEntities(match[1]) : undefined,
    code: match[2] ? decodeXmlEntities(match[2]) : undefined,
    content: decodeXmlEntities(match[3]?.trim() || 'Unknown error'),
  };
}

export function stripErrorTags(content: string): string {
  return content.replace(ERROR_TAG_GLOBAL_REGEX, (_match, _type, _code, inner: string) =>
    decodeXmlEntities(inner.trim())
  );
}

