import postcss from 'postcss';
import type { MarkdownThemePlatform } from './types';

const OBSIDIAN_PATTERNS = [
  /\.markdown-preview-view\b/i,
  /\.markdown-rendered\b/i,
  /\.markdown-reading-view\b/i,
  /\.markdown-source-view\b/i,
  /\.cm-s-obsidian\b/i,
  /\.mod-cm6\b/i,
  /--background-primary\b/i,
  /--text-normal\b/i,
  /--interactive-accent\b/i,
  /--accent-h\b/i,
  /--accent-s\b/i,
  /--accent-l\b/i,
];

const TYPORA_PATTERNS = [
  /#write\b/i,
  /\.md-fences\b/i,
  /\.md-toc\b/i,
  /\.md-diagram\b/i,
  /\.typora-sourceview-on\b/i,
  /\.typora-export\b/i,
  /--bg-color\b/i,
  /--text-color\b/i,
  /--md-char-color\b/i,
  /--active-file-bg-color\b/i,
];

function scoreThemePlatform(css: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern) => score + (pattern.test(css) ? 1 : 0), 0);
}

export function scoreMarkdownThemePlatforms(css: string): {
  obsidianScore: number;
  typoraScore: number;
} {
  return {
    obsidianScore: scoreThemePlatform(css, OBSIDIAN_PATTERNS),
    typoraScore: scoreThemePlatform(css, TYPORA_PATTERNS),
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
