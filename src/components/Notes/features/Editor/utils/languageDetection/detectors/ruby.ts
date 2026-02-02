import type { LanguageDetector } from '../types';

export const detectRuby: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces } = ctx;

  if (/^#'/m.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|interface\s+\w+|abstract\s+class)\b/.test(first100Lines)) {
    return null;
  }

  if (/^"\s*Vimball\s+Archiver/m.test(first100Lines) || /^UseVimball\s*$/m.test(first100Lines)) {
    return null;
  }

  if (/^class\s+\w+/m.test(first100Lines)) {

    if (/->|=>/.test(first100Lines) && !/\bdef\s+\w+/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(defmodule|defp|def\s+\w+.*\s+do\b|use\s+[A-Z]|import\s+[A-Z])\b/.test(first100Lines)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function|data\.frame)\b/.test(first100Lines)) {
    return null;
  }

  if (/^#!.*crystal/.test(firstLine)) {
    return null;
  }
  if (/require\s+["'].*spec_helper["']/.test(first100Lines)) {
    return null;
  }
  if (/\b(assert_type|describe\s+["'].*\s+do|property\s+\w+|getter\s+\w+|setter\s+\w+)\b/.test(first100Lines) && /:\s*[A-Z]\w*/.test(first100Lines)) {
    return null;
  }

  if (/\bdef\s+\w+\s*\([^)]*:\s*\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+scala\.|object\s+\w+\s+extends|case\s+class|val\s+\w+\s*:\s*\w+|var\s+\w+\s*:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return null;
  }

  if (firstLine.startsWith('# encoding:') || firstLine.startsWith('# frozen_string_literal:') || firstLine.startsWith('# typed:')) {
    return 'ruby';
  }

  if (/^require\s+/.test(first100Lines) || /^require_relative\s+/.test(first100Lines)) {
    if (/\b(module\s+\w+|class\s+\w+|def\s+\w+|end\b|attr_reader|attr_accessor|attr_writer)\b/.test(first100Lines)) {
      return 'ruby';
    }
  }

  if (/\b(describe|context|it|before|after)\s+['"]/.test(first100Lines) || /\b(describe|context)\s+\w+\s+do\b/.test(first100Lines)) {
    if (/\.should\b|expect\(/.test(first100Lines) || /\bdo\b/.test(first100Lines)) {
      return 'ruby';
    }
  }

  if (/\bsig\s*\{/.test(first100Lines)) {
    if (/\b(params|returns|void)\s*\(/.test(first100Lines) || /\bT\.(untyped|nilable)/.test(first100Lines)) {
      return 'ruby';
    }

    if (/\b(class|def)\s+\w+/.test(first100Lines)) {
      return 'ruby';
    }
  }

  if (/^module\s+\w+\s*$/m.test(first100Lines) || /^class\s+\w+\s*$/m.test(first100Lines)) {
    if (sample.includes('end')) {
      return 'ruby';
    }
  }

  if (/\b(attr_reader|attr_accessor|attr_writer)\s+:/.test(first100Lines)) {
    return 'ruby';
  }

  if (/\b(def\s+\w+|class\s+\w+\s*<|module\s+\w+|attr_accessor|attr_reader|attr_writer)\b/.test(first100Lines)) {
    if (sample.includes('end') &&
        (/\b(puts|print|gets|chomp|each|map|select|reject|nil\?|empty\?|require|include\s+\w+)\b/.test(first100Lines) ||
         /@\w+/.test(first100Lines))) {
      return 'ruby';
    }
  }

  if (!hasCurlyBraces && /\b(def|elsif|unless)\b/.test(first100Lines) && sample.includes('end')) {
    return 'ruby';
  }

  return null;
};
