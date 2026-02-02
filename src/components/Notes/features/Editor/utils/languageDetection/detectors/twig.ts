import type { LanguageDetector } from '../types';

export const detectTwig: LanguageDetector = (ctx) => {
  const { code } = ctx;

  if (/\|\s*(pluralize|money|asset_url|global_asset_url|shopify_asset_url|stylesheet_tag|script_tag|link_to)/.test(code)) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(code)) {

    if (/\{%\s*(autoescape|embed|filter|flush|sandbox|verbatim|do)\b/.test(code)) {
      return 'twig';
    }

    if (/\{%\s*(block|extends|macro|set|use|with)\b/.test(code)) {

      if (!/\{%\s*(assign|capture|tablerow|liquid|render)\b/.test(code)) {
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
