import { describe, expect, it, vi } from 'vitest';
import {
  extractHostFromUBlacklistRule,
  parseUBlacklistRules,
} from '../electron/webSearch/ublacklistRuleParser.mjs';

describe('uBlacklist rule parser', () => {
  it('extracts host candidates from common uBlacklist and adblock-style rules', () => {
    expect(extractHostFromUBlacklistRule('*://*.example.com/*')).toBe('example.com');
    expect(extractHostFromUBlacklistRule('*://example.org/path/*')).toBe('example.org');
    expect(extractHostFromUBlacklistRule('https://www.example.net/articles/*')).toBe('example.net');
    expect(extractHostFromUBlacklistRule('||download.example.com^')).toBe('download.example.com');
  });

  it('skips comments, exceptions, regex rules, and non-host filters', () => {
    expect(extractHostFromUBlacklistRule('! comment')).toBe('');
    expect(extractHostFromUBlacklistRule('# comment')).toBe('');
    expect(extractHostFromUBlacklistRule('@@*://example.com/*')).toBe('');
    expect(extractHostFromUBlacklistRule('/example\\.com\\/spam/')).toBe('');
    expect(extractHostFromUBlacklistRule('*://*.example.com/*$script')).toBe('');
  });

  it('does not coerce non-string rules or oversized rule text', () => {
    const rule = {
      toString: vi.fn(() => {
        throw new Error('rule should not be coerced');
      }),
    };

    expect(extractHostFromUBlacklistRule(rule)).toBe('');
    expect(parseUBlacklistRules(rule)).toEqual({ hosts: [], skippedRules: [] });
    expect(parseUBlacklistRules(`${'x'.repeat(1_000_001)}\n*://example.com/*`)).toEqual({
      hosts: [],
      skippedRules: [],
    });
    expect(rule.toString).not.toHaveBeenCalled();
  });

  it('deduplicates parsed hosts and records unsupported rules for manual review', () => {
    const parsed = parseUBlacklistRules(`
      ! list metadata
      *://*.example.com/*
      https://www.example.com/path/*
      ||another.example^
      /unsupported-regex/
      *://*/bad/*
    `);

    expect(parsed.hosts).toEqual(['example.com', 'another.example']);
    expect(parsed.skippedRules).toEqual(['*://*/bad/*']);
  });
});
