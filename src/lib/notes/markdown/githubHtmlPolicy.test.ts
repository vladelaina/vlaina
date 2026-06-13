import { describe, expect, it } from 'vitest';
import {
  GITHUB_ALLOWED_LINK_PROTOCOLS,
  GITHUB_ALLOWED_MEDIA_PROTOCOLS,
  normalizeGithubSrcset,
  normalizeGithubUrl,
} from './githubHtmlPolicy';

const REMOTE_MEDIA_OPTIONS = {
  allowPlainRelative: true,
  allowProtocolRelative: true,
  blockLocalNetwork: true,
} as const;

describe('githubHtmlPolicy', () => {
  it('rejects backslash-escaped URL schemes', () => {
    expect(normalizeGithubUrl(String.raw`data\:image/png;base64,aGk=`, GITHUB_ALLOWED_MEDIA_PROTOCOLS, REMOTE_MEDIA_OPTIONS)).toBeNull();
    expect(normalizeGithubUrl(String.raw`img\:assets/demo.png`, GITHUB_ALLOWED_MEDIA_PROTOCOLS, REMOTE_MEDIA_OPTIONS)).toBeNull();
    expect(normalizeGithubUrl(String.raw`mailto\:user@example.test`, GITHUB_ALLOWED_LINK_PROTOCOLS, {
      allowPlainRelative: true,
      blockLocalNetwork: true,
    })).toBeNull();
    expect(normalizeGithubSrcset(String.raw`data\:image/png;base64,aGk= 1x`)).toBeNull();
  });
});
