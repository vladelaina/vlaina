export const WEB_SEARCH_TOOL_NAMES = {
  search: 'web_search',
  read: 'read_web_page',
  readBatch: 'read_web_pages',
} as const;

export const WEB_SEARCH_SYSTEM_INSTRUCTION =
  'Search only when needed for fresh or verifiable info. For casual/general tasks, answer directly. If searching, read a page and cite URLs.';

export function buildWebSearchTools(): Array<Record<string, unknown>> {
  return [
    {
      type: 'function',
      function: {
        name: WEB_SEARCH_TOOL_NAMES.search,
        description: 'Find source candidates. Read pages before answering.',
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
        description: 'Read one page.',
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
        description: 'Read multiple pages.',
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
