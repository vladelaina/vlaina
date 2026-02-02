import type { LanguageDetector } from '../types';

export const detectSvelte: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/\$:\s*\w+\s*=/.test(code)) {
    return 'svelte';
  }

  if (/\{#if\s+|\{#each\s+|\{#await\s+/.test(code)) {

    if (!/\{\{#/.test(code)) {
      return 'svelte';
    }
  }

  if (/\s(on:|bind:|use:|transition:|in:|out:|animate:)\w+/.test(code)) {
    return 'svelte';
  }

  if (/<script\s+context=["']module["']/.test(code)) {
    return 'svelte';
  }

  if (/<script[\s>]/.test(code) && /<\/script>/.test(code)) {

    if (/\b(export\s+let|createEventDispatcher|onMount|onDestroy|beforeUpdate|afterUpdate)\b/.test(first100Lines)) {
      return 'svelte';
    }

    if (/\{#|\$:/.test(code)) {
      return 'svelte';
    }
  }

  return null;
};
