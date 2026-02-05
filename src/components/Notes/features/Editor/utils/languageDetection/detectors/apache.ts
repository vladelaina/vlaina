import type { LanguageDetector } from '../types';

export const detectApache: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  // Simple single-line Apache patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Apache directive: ServerName example.com
    if (/^(ServerName|ServerAlias|DocumentRoot|DirectoryIndex|ErrorLog|CustomLog|RewriteEngine|AllowOverride|Require|Options)\s+/.test(trimmed)) {
      return 'apache';
    }
  }

  if (/\{[\s\S]*?\}/.test(first100Lines) && /[.#][\w-]+\s*\{/.test(first100Lines)) {
    return null;
  }

  // Apache configuration tags (must be before XML check)
  if (/<(VirtualHost|Directory|Location|Files|IfModule|IfDefine)/.test(code)) {
    // Check for Apache-specific directives
    if (/\b(ServerName|DocumentRoot|AllowOverride)\b/.test(code)) {
      return 'apache';
    }
    return 'apache';
  }

  if (/^RewriteRule\s+\S+\s+\S+(\s+\[[^\]]+\])?/m.test(code) ||
      /^RewriteCond\s+\S+\s+\S+(\s+\[[^\]]+\])?/m.test(code)) {
    return 'apache';
  }

  if (/^RewriteEngine\s+(On|Off)/mi.test(code)) {
    return 'apache';
  }

  const apacheKeywords = (code.match(/\b(ServerName|ServerAlias|DocumentRoot|DirectoryIndex|ErrorLog|CustomLog|RewriteEngine|RewriteRule|RewriteCond|AllowOverride|Require|Options|Order|Allow|Deny)\b/g) || []).length;
  if (apacheKeywords >= 3) {
    return 'apache';
  }

  return null;
};
