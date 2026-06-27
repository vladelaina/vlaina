const WEB_SEARCH_REQUEST_TAG_REGEX = /<web_search_request\b/i;
const WEB_SEARCH_REQUEST_BLOCK_REGEX = /<web_search_request\b[^>]*>[\s\S]*?<\/web_search_request>/i;

export function containsWebSearchRequestMarkup(content: string): boolean {
  return WEB_SEARCH_REQUEST_TAG_REGEX.test(content);
}

export function stripWebSearchRequestMarkup(content: string): string {
  const block = WEB_SEARCH_REQUEST_BLOCK_REGEX.exec(content);
  if (block) {
    return content.slice(block.index + block[0].length).trimStart();
  }

  return containsWebSearchRequestMarkup(content) ? '' : content;
}
