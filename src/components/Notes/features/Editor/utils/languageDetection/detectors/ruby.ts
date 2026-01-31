import type { LanguageDetector } from '../types';

export const detectRuby: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces } = ctx;
  
  // Exclude TypeScript/JavaScript files first
  if (/\b(import\s+.*from|export\s+(default|const|function)|interface\s+\w+|abstract\s+class)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Scala files - check for Scala-specific patterns
  // Check for def with parameter types: def name(param: Type)
  if (/\bdef\s+\w+\s*\([^)]*:\s*\w+/.test(first100Lines)) {
    return null;
  }
  
  if (/\b(import\s+scala\.|object\s+\w+\s+extends|case\s+class|val\s+\w+\s*:\s*\w+|var\s+\w+\s*:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Scala build files - check for := operator
  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return null;
  }
  
  // Ruby encoding comment
  if (firstLine.startsWith('# encoding:') || firstLine.startsWith('# frozen_string_literal:') || firstLine.startsWith('# typed:')) {
    return 'ruby';
  }
  
  // Ruby require statements (with or without quotes)
  if (/^require\s+/.test(first100Lines) || /^require_relative\s+/.test(first100Lines)) {
    if (/\b(module\s+\w+|class\s+\w+|def\s+\w+|end\b|attr_reader|attr_accessor|attr_writer)\b/.test(first100Lines)) {
      return 'ruby';
    }
  }
  
  // Ruby RSpec/testing patterns
  if (/\b(describe|context|it|before|after)\s+['"]/.test(first100Lines) || /\b(describe|context)\s+\w+\s+do\b/.test(first100Lines)) {
    if (/\.should\b|expect\(/.test(first100Lines) || /\bdo\b/.test(first100Lines)) {
      return 'ruby';
    }
  }
  
  // Ruby type signatures (Sorbet) - .rbi files
  if (/\bsig\s*\{/.test(first100Lines)) {
    if (/\b(params|returns|void)\s*\(/.test(first100Lines) || /\bT\.(untyped|nilable)/.test(first100Lines)) {
      return 'ruby';
    }
  }
  
  // Simple Ruby files - just module/class with end
  if (/^module\s+\w+\s*$/m.test(first100Lines) || /^class\s+\w+\s*$/m.test(first100Lines)) {
    if (sample.includes('end')) {
      return 'ruby';
    }
  }
  
  // Ruby attr_* declarations
  if (/\b(attr_reader|attr_accessor|attr_writer)\s+:/.test(first100Lines)) {
    return 'ruby';
  }
  
  // Strong Ruby indicators - must have 'end' keyword
  if (/\b(def\s+\w+|class\s+\w+\s*<|module\s+\w+|attr_accessor|attr_reader|attr_writer)\b/.test(first100Lines)) {
    if (sample.includes('end') && 
        (/\b(puts|print|gets|chomp|each|map|select|reject|nil\?|empty\?|require|include\s+\w+)\b/.test(first100Lines) ||
         /@\w+/.test(first100Lines))) {
      return 'ruby';
    }
  }
  
  // Ruby-specific patterns - must have 'end'
  if (!hasCurlyBraces && /\b(def|elsif|unless)\b/.test(first100Lines) && sample.includes('end')) {
    return 'ruby';
  }
  
  return null;
};
