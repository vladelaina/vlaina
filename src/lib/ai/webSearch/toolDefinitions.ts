export const WEB_SEARCH_TOOL_NAMES = {
  search: 'web_search',
  read: 'read_web_page',
  readBatch: 'read_web_pages',
} as const;

export const WEB_SEARCH_SYSTEM_INSTRUCTION =
  'Web search is available. If asked about it, say yes. Search for explicit search requests or fresh/verifiable facts; otherwise answer directly. After search, read a page and cite URLs.';

export function buildWebSearchTools(): Array<Record<string, unknown>> {
  return [
    {
      type: 'function',
      function: {
        name: WEB_SEARCH_TOOL_NAMES.search,
        description: 'Find sources. Read before answering.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Keywords.' },
            category: {
              type: 'string',
              enum: ['general', 'news', 'science', 'it', 'images', 'videos'],
              description: 'Optional category.',
            },
            timeRange: {
              type: 'string',
              enum: ['day', 'week', 'month', 'year'],
              description: 'Optional freshness.',
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
            url: { type: 'string', description: 'HTTP(S) URL.' },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: WEB_SEARCH_TOOL_NAMES.readBatch,
        description: 'Read pages.',
        parameters: {
          type: 'object',
          properties: {
            urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'HTTP(S) URLs.',
            },
          },
          required: ['urls'],
        },
      },
    },
  ];
}
