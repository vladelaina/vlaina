import { describe, expect, it } from 'vitest';
import { sanitizeWebSearchSourceUrl, sanitizeWebSearchStatuses } from './status';

describe('web search status policy', () => {
  it('keeps public HTTP sources and blocks local-network URLs', () => {
    expect(sanitizeWebSearchSourceUrl('https://example.com/page')).toBe('https://example.com/page');
    expect(sanitizeWebSearchSourceUrl('http://127.0.0.1/private')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('http://router.local/admin')).toBeNull();
  });

  it('bounds and sanitizes persisted statuses', () => {
    expect(sanitizeWebSearchStatuses([{
      phase: 'complete',
      urls: ['https://example.com', 'http://localhost/private'],
      metrics: { successCount: 1, failureCount: -1 },
    }])).toEqual([{
      phase: 'complete',
      urls: ['https://example.com'],
      metrics: { successCount: 1, failureCount: 0 },
    }]);
  });
});
