export const WEB_SEARCH_TOOL_NAMES = {
  search: 'web_search',
  read: 'read_web_page',
  readBatch: 'read_web_pages',
} as const;

export const WEB_SEARCH_SYSTEM_INSTRUCTION =
  'When web search is enabled, use the web_search tool first for current or source-dependent questions. ' +
  'Then choose the most relevant results and read pages with read_web_page or read_web_pages before answering. ' +
  'Do not answer from search result snippets alone; after every successful search, read at least one relevant page unless no results are available. ' +
  'Synthesize across sources, include source links in the final answer, and do not answer only from snippets.';

export function buildWebSearchTools(): Array<Record<string, unknown>> {
  return [
    {
      type: 'function',
      function: {
        name: WEB_SEARCH_TOOL_NAMES.search,
        description:
          'Search the web for candidate sources. This only finds candidates; after searching, read selected result pages before answering with source links.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keywords.' },
            category: {
              type: 'string',
              enum: ['general', 'news', 'science', 'it', 'images', 'videos'],
              description: 'Optional result category.',
            },
            timeRange: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year'],
              description: 'Optional freshness window.',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: WEB_SEARCH_TOOL_NAMES.read,
        description: 'Read one web page and return cleaned article text, title, summary, site name, and final URL.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The HTTP or HTTPS URL to read.' },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: WEB_SEARCH_TOOL_NAMES.readBatch,
        description:
          'Read multiple web pages. Each URL succeeds or fails independently; use this after searching to inspect several candidate sources.',
        parameters: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'HTTP or HTTPS URLs to read.',
            },
          },
          required: ['urls'],
        },
      },
    },
  ];
}
