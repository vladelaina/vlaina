import { describe, expect, it } from 'vitest';
import { getDomAttrs } from './themeSchemaUtils';

describe('themeSchemaUtils', () => {
  it('keeps primitive DOM attrs without coercing objects', () => {
    const hostileValue = {
      toString() {
        throw new Error('DOM attr coercion');
      },
    };

    expect(getDomAttrs({
      class: 'md-image',
      value: 12,
      hidden: false,
      unsafe: hostileValue,
      missing: undefined,
    })).toEqual({
      class: 'md-image',
      value: '12',
      hidden: 'false',
    });
  });
});
