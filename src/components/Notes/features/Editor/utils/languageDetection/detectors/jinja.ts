import type { LanguageDetector } from '../types';

export const detectJinja: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  // Simple single-line Jinja patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Jinja variable: <h1>{{ title }}</h1>
    if (/^<\w+>\{\{\s*\w+\s*\}\}<\/\w+>$/.test(trimmed)) {
      // Could be Jinja, Liquid, or Twig - check for specific patterns
      // Jinja is more common in Python web frameworks
      return 'jinja';
    }
    if (/\{\{\s*\w+\.\w+\s*\}\}/.test(code) && !/\{%/.test(code)) {
      return 'jinja';
    }
  }

  if (/^(Nonterminals|Terminals)\b/m.test(first100Lines)) {
    return null;
  }

  if (/^"\s/m.test(first100Lines) && /"\{\{\{/.test(code)) {
    return null;
  }

  if (/\|\s*(append|pluralize|money|asset_url|global_asset_url|shopify_asset_url|stylesheet_tag|script_tag|link_to|link_to_add_tag|link_to_tag|highlight_active_tag)/.test(code)) {
    return null;
  }

  // Jinja extends (must be before Twig check)
  if (/\{%\s*extends\s+["']/.test(code)) {
    // Twig-specific filters that Jinja doesn't have
    if (/\|\s*(date|money|asset_url|url_encode|json_encode|merge|batch|slice)\b/.test(code)) {
      return null; // Let Twig handle it
    }
    // Jinja-specific: uses "block" without "endblock" in simple cases
    // or has Python-like filters
    if (/\{%\s*block\s+\w+\s*%\}/.test(code)) {
      return 'jinja';
    }
  }

  // Jinja for/if blocks
  if (/\{%\s*(for|if)\s+\w+\s+in\s+\w+/.test(code)) {
    if (/\{%\s*endfor\s*%\}|\{%\s*endif\s*%\}/.test(code) || /\{\{[\s\S]*?\}\}/.test(code)) {
      // Check if it's not Twig (Twig has different filters)
      if (!/\|\s*(date|money|asset_url)\b/.test(code)) {
        return 'jinja';
      }
    }
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
