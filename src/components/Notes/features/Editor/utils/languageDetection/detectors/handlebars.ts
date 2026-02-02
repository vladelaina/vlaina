import type { LanguageDetector } from '../types';

export const detectHandlebars: LanguageDetector = (ctx) => {
  const { code } = ctx;

  if (/\{#(if|each|await)\s+/.test(code) && !/\{\{#/.test(code)) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(code) && /\{\{[\s\S]*?\|/.test(code)) {
    return null;
  }

  if (/\{\{[\s\S]*?\}\}/.test(code)) {

    if (/\{\{#(if|each|with|unless)/.test(code)) {
      return 'handlebars';
    }

    if (/@(root|index|key|first|last)/.test(code)) {
      return 'handlebars';
    }

    if (/\{\{>\s*\w+/.test(code)) {
      return 'handlebars';
    }

    if (/\{\{#\w+\}\}[\s\S]*?\{\{\/\w+\}\}/.test(code)) {
      return 'handlebars';
    }

    if (/\{\{\w+\s+\w+/.test(code)) {
      return 'handlebars';
    }

    if (/<(div|span|p|h[1-6]|body|html|ul|li|table|tr|td)[\s>]/.test(code)) {

      const handlebarsCount = (code.match(/\{\{\w+\}\}/g) || []).length;

      if (handlebarsCount >= 2 && !/\{%/.test(code) && !/\{\{[\s\S]*?\|/.test(code)) {
        return 'handlebars';
      }
    }

    if (!/\{%/.test(code) && !/\{\{[\s\S]*?\|/.test(code) && !/<script|<style/.test(code)) {
      const simpleExpressions = (code.match(/\{\{\w+\}\}/g) || []).length;
      if (simpleExpressions >= 2) {
        return 'handlebars';
      }
    }
  }

  return null;
};
