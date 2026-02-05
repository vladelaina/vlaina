import type { LanguageDetector } from '../types';

export const detectTwig: LanguageDetector = (ctx) => {
  const { code, lines } = ctx;

  // Simple single-line Twig patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Twig variable: <h1>{{ title }}</h1>
    if (/^<\w+>\{\{\s*\w+\s*\}\}<\/\w+>$/.test(trimmed)) {
      // Could be Jinja, Liquid, or Twig
      // Let Jinja handle it (more common)
      return null;
    }
  }

  if (/\|\s*(pluralize|money|asset_url|global_asset_url|shopify_asset_url|stylesheet_tag|script_tag|link_to)/.test(code)) {
    return null;
  }

  if (/\{%\s*for\s+\w+\s+in\s+\w+\s*\|\s*filter\(/.test(code)) {
    if (/\bu\s*=>/.test(code) || /\w+\s*=>\s*\w+\./.test(code)) {
      return 'twig';
    }
  }

  if (/\{%[\s\S]*?%\}/.test(code)) {

    if (/\{%\s*(autoescape|embed|filter|flush|sandbox|verbatim|do)\b/.test(code)) {
      return 'twig';
    }

    if (/\{%\s*(block|extends|macro|set|use|with)\b/.test(code)) {
      // Check for Twig-specific filters that Jinja doesn't have
      if (/\|\s*(date|json_encode|url_encode|merge|batch|slice)\b/.test(code)) {
        return 'twig';
      }
      
      // If no Twig-specific filters, let Jinja handle it
      if (!/\{%\s*(assign|capture|tablerow|liquid|render)\b/.test(code)) {
        // Check if it's more likely Jinja (has Python-like filters)
        if (/\|\s*(currency|truncate|safe|escape)\b/.test(code)) {
          return null; // Let Jinja handle it
        }
        return 'twig';
      }
    }
  }

  if (/\{\{[\s\S]*?\}\}/.test(code) && /\|\s*\w+/.test(code)) {

    if (/\|\s*(abs|batch|convert_encoding|format|json_encode|keys|merge|nl2br|number_format|raw|reverse|round|striptags|title|url_encode)/.test(code)) {
      return 'twig';
    }
  }

  return null;
};
