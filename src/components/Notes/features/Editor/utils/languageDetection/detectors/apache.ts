import type { LanguageDetector } from '../types';

export const detectApache: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/\{[\s\S]*?\}/.test(first100Lines) && /[.#][\w-]+\s*\{/.test(first100Lines)) {

    return null;
  }

  if (/<(VirtualHost|Directory|Location|Files|IfModule|IfDefine)/.test(code)) {
    return 'apache';
  }

  const apacheKeywords = (code.match(/\b(ServerName|ServerAlias|DocumentRoot|DirectoryIndex|ErrorLog|CustomLog|RewriteEngine|RewriteRule|RewriteCond|AllowOverride|Require|Options|Order|Allow|Deny)\b/g) || []).length;
  if (apacheKeywords >= 3) {
    return 'apache';
  }

  return null;
};
