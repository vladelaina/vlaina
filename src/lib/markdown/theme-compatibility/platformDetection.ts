import postcss from 'postcss';
import type { MarkdownThemePlatform } from './types';
import { OBSIDIAN_THEME_PATTERNS } from './obsidian/detection';
import { TYPORA_THEME_PATTERNS } from './typora/detection';

function scoreThemePlatform(css: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => score + (pattern.test(css) ? 1 : 0), 0);
}

export function scoreMarkdownThemePlatforms(css: string): {
  obsidianScore: number;
  typoraScore: number;
} {
  return {
    obsidianScore: scoreThemePlatform(css, OBSIDIAN_THEME_PATTERNS),
    typoraScore: scoreThemePlatform(css, TYPORA_THEME_PATTERNS),
  };
}

export function detectMarkdownThemePlatform(css: string): MarkdownThemePlatform {
  const { obsidianScore, typoraScore } = scoreMarkdownThemePlatforms(css);

  if (obsidianScore > typoraScore) return 'obsidian';
  return 'typora';
}

export function isStandaloneMarkdownThemeCss(css: string): boolean {
  const { obsidianScore, typoraScore } = scoreMarkdownThemePlatforms(css);
  if (obsidianScore > 0 || typoraScore > 0) return true;

  try {
    const root = postcss.parse(css, { from: undefined });
    let hasStyleRule = false;
    root.walkRules((rule) => {
      if (isKeyframesRule(rule)) return;
      if (rule.nodes?.some((node) => node.type === 'decl')) {
        hasStyleRule = true;
      }
    });
    return hasStyleRule;
  } catch {
    return false;
  }
}

function isKeyframesRule(rule: postcss.Rule): boolean {
  let parent = rule.parent as postcss.AnyNode | undefined;
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) {
      return true;
    }
    parent = parent.parent as postcss.AnyNode | undefined;
  }
  return false;
}
