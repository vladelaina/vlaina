import { describe, expect, it } from 'vitest';
import { stripWebSearchRequestMarkup } from './requestMarkup';

describe('web search request markup', () => {
  it('strips leaked decision text and complete request markup while preserving a later answer', () => {
    const content = [
      'We need to search first.',
      '<web_search_request>{"query":"catime","reason":"current info"}</web_search_request>',
      'Catime answer.',
    ].join('\n');

    expect(stripWebSearchRequestMarkup(content)).toBe('Catime answer.');
  });

  it('strips unterminated request markup entirely', () => {
    expect(stripWebSearchRequestMarkup('Need search.\n<web_search_request>{"query":"catime"')).toBe('');
  });

  it('leaves normal content untouched', () => {
    expect(stripWebSearchRequestMarkup('Normal answer.')).toBe('Normal answer.');
  });
});
