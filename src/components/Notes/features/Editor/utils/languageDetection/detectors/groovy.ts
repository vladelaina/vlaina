import type { LanguageDetector } from '../types';

export const detectGroovy: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  if (
    /(?:^|\n)\s*@[a-z_]\w*(?:\.[a-z_]\w*)*(?:\([^)\n]*\))?\s*$/im.test(code) &&
    /(?:^|\n)\s*(?:async\s+def|def|class)\s+\w+[^\n]*:/.test(code)
  ) {
    return null;
  }

  if (/(?:^|\n)\s*(?:async\s+def|def)\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code)) {
    return null;
  }

  if (/(?:^|\n)\s*class\s+\w+(?:\([^)\n]*\))?\s*:/.test(code)) {
    return null;
  }

  if (/\b(import\s+\{|\bconst\b|\blet\b|\bvar\b|export\s+default)\b/.test(first100Lines)) {
    return null;
  }

  // Simple single-line Groovy patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Groovy closure: def square = { it * it }
    if (/^def\s+\w+\s*=\s*\{\s*it\s*[*+\-\/]/.test(trimmed)) {
      return 'groovy';
    }
  }

  if (/^#!.*groovy/.test(firstLine)) {
    return 'groovy';
  }

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      /^package\s+[\w:]+;/m.test(first100Lines) ||
      /^=head\d+\s+/m.test(first100Lines)) {
    return null;
  }

  if (/^\w+\s*\{/m.test(first100Lines)) {

    if (/\{\s*\w+\s+["']/.test(code) ||
        /\{\s*\w+\s*\{/.test(code)) {

      const blockCount = (code.match(/\w+\s*\{/g) || []).length;
      if (blockCount >= 3) {
        return 'groovy';
      }
    }
  }

  if (/#include\s*[<"]/.test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(require|module\s+\w+|class\s+\w+\s*<|attr_accessor|attr_reader)\b/.test(first100Lines) && /\bend\b/.test(code)) {
    return null;
  }

  if (/\b(defmodule|defp|def\s+\w+\s+do|use\s+\w+|import\s+\w+|alias\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/^-module\(|^-export\(|^-include\(/.test(first100Lines)) {
    return null;
  }

  if (/\b(require\s+["']|module\s+\w+|class\s+\w+\s*<|def\s+\w+\s*:|property\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  // Exclude Ruby Rails models (strong Ruby indicators)
  if (/class\s+\w+\s*<\s*(ApplicationRecord|ActiveRecord::Base)/.test(first100Lines)) {
    return null;
  }

  if (/\b(has_many|belongs_to|validates)\s+:\w+/.test(first100Lines)) {
    const railsCount = (code.match(/\b(has_many|belongs_to|has_one|validates|scope|before_save|after_create)\b/g) || []).length;
    if (railsCount >= 2) {
      return null;
    }
  }

  if (/^\(ns\s+|^\(def\s+|^\(defn\s+/.test(first100Lines)) {
    return null;
  }

  if (/\b(module\s+\w+\s+exposing|import\s+\w+\s+exposing|type\s+alias\s+\w+\s*=)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(CMAKE_|MACRO|ENDMACRO|FUNCTION|ENDFUNCTION)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(fn\s+main|pub\s+fn|impl\s+\w+|use\s+std::)\b/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^import\s+java\./m.test(first100Lines)) {
    return null;
  }

  if (
    /^import\s+(?:static\s+)?(?:java|javax|jakarta|org\.(?:springframework|junit|apache)|com\.(?:fasterxml|intellij))\./m.test(first100Lines) ||
    /(?:^|\n)\s*@(Override|Deprecated|SuppressWarnings|Test|RestController|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|Autowired|Component|Service|Repository|Controller|Entity|Table|Column|Id)\b/m.test(code) ||
    /\bSystem\.out\.println\s*\(/.test(code) ||
    /(?:^|\n)\s*(?:(?:public|protected|private)\s+)?class\s+[A-Z]\w*(?:\s+extends\s+[^{\n]+)?(?:\s+implements\s+[^{\n]+)?\s*\{/.test(code) ||
    /\b(?:throws\s+[A-Z]\w*|synchronized\s*\(|new\s+Thread\s*\(|instanceof\s+[A-Z]\w+\s+[a-z_]\w*)/.test(code)
  ) {
    return null;
  }

  if (/^[\w-]+:\s*$/m.test(code) && /^\t/.test(code)) {
    return null;
  }

  if (/\bdef\s+\w+\s*=.*\.(findAll|collect|each|eachWithIndex)\s*\{/.test(code)) {
    return 'groovy';
  }

  if (/\bprintln\s+["']/.test(code) && !/;/.test(code)) {
    if (lines.length <= 3) {
      return 'groovy';
    }
  }

  if (/\bdef\s+\w+\s*=|\bdef\s+\w+\(/.test(code)) {

    if (/\{[\s\S]*?->[\s\S]*?\}/.test(code) ||
        /"\$\{[\s\S]*?\}"/.test(code) ||
        /@\w+\s*\n\s*def/.test(code) ||
        /\bpackage\s+\w+/.test(first100Lines) ||
        /\bclass\s+\w+\s*\{/.test(code)) {
      return 'groovy';
    }
  }

  if (/\{[\s\S]*?->[\s\S]*?\}/.test(code)) {
    if (/\bdef\s+/.test(code) || /\bclass\s+\w+\s*\{/.test(code)) {
      return 'groovy';
    }
  }

  if (/\b(dependencies|repositories|plugins|apply\s+plugin)\s*\{/.test(code)) {
    if (/\bimplementation\s+['"]|compile\s+['"]|testImplementation\s+['"]/.test(code)) {
      return 'groovy';
    }
  }

  if (/\btask\s+\w+\s*\(/.test(code) || /\btask\s+\w+\s*\{/.test(code)) {

    if (/\bant\.\w+|description\s*=|doLast\s*\{/.test(code)) {
      return 'groovy';
    }
  }

  if (/\bant\.\w+\(/.test(code)) {
    return 'groovy';
  }

  return null;
};
