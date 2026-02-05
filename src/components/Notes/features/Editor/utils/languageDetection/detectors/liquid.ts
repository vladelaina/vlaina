import type { LanguageDetector } from '../types';

export const detectLiquid: LanguageDetector = (ctx) => {
  const { code, lines } = ctx;

  // Simple single-line Liquid patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Liquid variable with page object: <h1>{{ page.title }}</h1>
    if (/^<\w+>\{\{\s*page\.\w+\s*\}\}<\/\w+>$/.test(trimmed)) {
      return 'liquid';
    }
    if (/\{\{\s*\w+\.\w+\s*\}\}/.test(code) && !/\{%/.test(code)) {
      // Check if it's Liquid-specific (page, site, etc.)
      if (/\{\{\s*(page|site|content|layout)\.\w+/.test(code)) {
        return 'liquid';
      }
      // Otherwise, let Jinja handle it (more common)
      return null;
    }
  }

  if (/\{%\s*(extends|block|macro|set|import)\b/.test(code)) {
    return null;
  }

  if (/\{%-?\s*(if\s+not|elif)\b/.test(code) || /\{%-[\s\S]*?-%\}/.test(code)) {
    return null;
  }

  const liquidFilters = /\|\s*(pluralize|money|asset_url|global_asset_url|shopify_asset_url|stylesheet_tag|script_tag|link_to|link_to_add_tag|link_to_tag|link_to_vendor|link_to_type|highlight_active_tag|product_img_url|json)\b/.test(code);

  const liquidTags = /\{%\s*(assign|capture|tablerow|liquid|render|cycle|case|when)\b/.test(code);

  if (liquidFilters || liquidTags) {
    return 'liquid';
  }

  if (/\{%[\s\S]*?%\}/.test(code) && /\{\{[\s\S]*?\|/.test(code)) {

    if (/\{%\s*for\s+\w+\s+in\s+/.test(code)) {

      if (/\{%\s*endfor\s*%\}/.test(code)) {

        if (!/\{%\s*(extends|block|macro|set|import|if\s+not|elif)\b/.test(code) && !/\{%-[\s\S]*?-%\}/.test(code)) {
          return 'liquid';
        }
      }
    }

    if (/\{%\s*if\s+/.test(code)) {

      if (/\{%\s*endif\s*%\}/.test(code)) {

        if (!/\{%\s*(extends|block|macro|set|import|if\s+not|elif)\b/.test(code) && !/\{%-[\s\S]*?-%\}/.test(code)) {

          const commonFilters = (code.match(/\|\s*(capitalize|date|default|escape|first|join|last|size|split|strip|upcase|downcase|truncate|remove|replace|slice|append)\b/g) || []).length;
          if (commonFilters >= 2) {
            return 'liquid';
          }
        }
      }
    }
  }

  if (/\{\{[\s\S]*?\}\}/.test(code) && /\{\{[\s\S]*?\|/.test(code)) {

    const liquidPatterns = [
      /\|\s*(append|capitalize|date|default|escape|first|join|last|size|split|strip|upcase|downcase|truncate|remove|replace|slice)\b/.test(code),
      /\{%\s*(for|if|unless)\s+/.test(code),
      /\{%\s*end(for|if)\s*%\}/.test(code),
      /\{\{\s*\w+\.\w+/.test(code),
    ].filter(Boolean).length;

    if (liquidPatterns >= 2 && !/\{%\s*(extends|block|macro|set|import|if\s+not|elif)\b/.test(code) && !/\{%-[\s\S]*?-%\}/.test(code)) {
      return 'liquid';
    }
  }

  return null;
};
