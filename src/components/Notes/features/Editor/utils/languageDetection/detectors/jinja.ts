import type { LanguageDetector } from '../types';

export const detectJinja: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/^(Nonterminals|Terminals)\b/m.test(first100Lines)) {
    return null;
  }

  if (/^"\s/m.test(first100Lines) && /"\{\{\{/.test(code)) {
    return null;
  }

  if (/\|\s*(append|pluralize|money|asset_url|global_asset_url|shopify_asset_url|stylesheet_tag|script_tag|link_to|link_to_add_tag|link_to_tag|highlight_active_tag)/.test(code)) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(code)) {

    if (/\{%\s*(extends|block|macro|set|import|from)\b/.test(code)) {
      return 'jinja';
    }

    if (/\{%\s*(if|for)\b/.test(code)) {

      if (/\{%\s*(extends|block|macro|set|import|from)\b/.test(code) ||
          /\{\{[\s\S]*?\|[\s\S]*?\}\}/.test(code)) {
        return 'jinja';
      }
    }
  }

  if (/\{\{[\s\S]*?\}\}/.test(code) && /\|[\w]+/.test(code)) {

    if (!/\{%\s*(assign|capture|tablerow|liquid|render)\b/.test(code)) {
      return 'jinja';
    }
  }

  return null;
};
