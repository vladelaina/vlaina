import { describe, expect, it } from 'vitest';
import {
  buildErrorTag,
  MAX_ERROR_TAG_ATTRIBUTE_CHARS,
  MAX_ERROR_TAG_CONTENT_CHARS,
  parseErrorTag,
  stripErrorTags,
  stripFirstErrorTag,
} from './errorTag';

describe('errorTag', () => {
  it('parses and strips escaped error tag payloads', () => {
    const tag = buildErrorTag('NETWORK_ERROR', 'upstream', 'Bad <gateway> & timeout');

    expect(parseErrorTag(`prefix ${tag}`)).toEqual({
      type: 'NETWORK_ERROR',
      code: 'upstream',
      content: 'Bad <gateway> & timeout',
    });
    expect(stripErrorTags(`before ${tag} after`)).toBe('before Bad <gateway> & timeout after');
    expect(stripFirstErrorTag(`before ${tag} after`)).toBe('before  after');
  });

  it('bounds error tag fields before exposing them', () => {
    const parsed = parseErrorTag(buildErrorTag(
      't'.repeat(MAX_ERROR_TAG_ATTRIBUTE_CHARS + 1),
      'c'.repeat(MAX_ERROR_TAG_ATTRIBUTE_CHARS + 1),
      'x'.repeat(MAX_ERROR_TAG_CONTENT_CHARS + 1),
    ));

    expect(parsed?.type).toHaveLength(MAX_ERROR_TAG_ATTRIBUTE_CHARS);
    expect(parsed?.code).toHaveLength(MAX_ERROR_TAG_ATTRIBUTE_CHARS);
    expect(parsed?.content).toHaveLength(MAX_ERROR_TAG_CONTENT_CHARS);
  });

  it('continues scanning after malformed oversized start tags', () => {
    const malformed = `<error ${'x'.repeat(4097)}>`;
    const valid = '<error type="AUTH_ERROR" code="login">Sign in</error>';

    expect(parseErrorTag(`${malformed}${valid}`)).toEqual({
      type: 'AUTH_ERROR',
      code: 'login',
      content: 'Sign in',
    });
  });
});
