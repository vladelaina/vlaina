import type { LanguageDetector } from '../types';

export const detectPython: LanguageDetector = (ctx) => {
  const { firstLine, first100Lines, lines, hasCurlyBraces, code } = ctx;

  // Simple single-line Python patterns
  if (lines.length <= 3) {
    if (/^print\s*\(/.test(code.trim())) {
      // Check for Python-specific patterns
      if (/^print\s*\(\s*["']/.test(code.trim()) && !/\bvar\b|\blet\b|\bfunc\b/.test(code)) {
        return 'python';
      }
    }
  }

  // Python import statements - must be before JavaScript check
  if (/^from\s+\w+\s+import\s+/.test(first100Lines)) {
    // Python-style: from X import Y (no quotes, no semicolons)
    if (!/['"]/.test(first100Lines) && !/;/.test(first100Lines)) {
      return 'python';
    }
  }
  
  if (/^import\s+\w+/.test(first100Lines)) {
    // Check for Python-specific imports or Python-style imports (no semicolons)
    if (/\bimport\s+(numpy|pandas|matplotlib|scipy|sklearn|torch|tensorflow|typing|os|sys|re|json|math|random|datetime|collections|itertools)\b/.test(first100Lines)) {
      return 'python';
    }
    // Python import without semicolon
    if (!/;/.test(first100Lines) && !/\bfrom\s+['"]/.test(first100Lines)) {
      return 'python';
    }
  }

  // Python import statements
  if (/^(import|from)\s+\w+/.test(first100Lines)) {
    // Exclude Haskell (imports start with capital letter)
    if (/^import\s+(qualified\s+)?[A-Z][\w.]*/.test(first100Lines)) {
      // Check if it's Haskell (has type signatures or data types)
      if (/::\s*[A-Z]/.test(code) || /^data\s+[A-Z]/.test(code) || /\bderiving\s*\(/.test(code)) {
        return null;
      }
    }
    
    if (/\bfrom\s+typing\s+import\b/.test(first100Lines) || 
        /\bimport\s+(numpy|pandas|matplotlib|scipy|sklearn|torch|tensorflow)\b/.test(first100Lines)) {
      return 'python';
    }
    // Check for Python-style imports (no 'from' with quotes)
    if (/^from\s+\w+\s+import\s+\w+/.test(first100Lines) && !/['"]/.test(first100Lines)) {
      return 'python';
    }
  }

  if (firstLine.startsWith('# -*- coding:') || firstLine.startsWith('# coding:')) {
    return 'python';
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      (/^sub\s+\w+\s*\{/m.test(first100Lines) && /[\$@%][\w]+/.test(first100Lines))) {
    return null;
  }

  if (/^#!.*crystal/.test(firstLine) ||
      /require\s+["'].*spec_helper["']/.test(first100Lines) ||
      (/\bdescribe\s+["']/.test(code) && /\.should\s+(eq|be_true|be_false|be_nil)/.test(code)) ||
      (/^module\s+[A-Z]\w*$/m.test(first100Lines) && /\bdef\s+\w+/.test(first100Lines) && /\bend\b/.test(code))) {
    return null;
  }

  if (/^\(ns\s+[\w.-]+|^\((def|defn|defmacro|deftask)\s+/m.test(first100Lines)) {
    return null;
  }
  if (/^;;/.test(first100Lines) && /^\(/m.test(first100Lines)) {
    return null;
  }

  if (/\bwith\s+open\s*\(/.test(code) && /\bas\s+\w+:/.test(code)) {
    return 'python';
  }

  if (/^lambda\s+[\w,\s]+:/.test(code.trim())) {
    return 'python';
  }

  if (/\[.+\s+for\s+\w+\s+in\s+.+\]/.test(code)) {
    if (/\[\s*\w+\s*\^\s*\d+\s+for\s+\w+\s+in\s+\d+:\d+/.test(code)) {
      return null;
    }
    if (/\bfor\s+\w+\s+in\s+\d+:\d+/.test(code) && /\^\d+/.test(code)) {
      return null;
    }
    return 'python';
  }

  if (/^@\w+(\.\w+)*(\(.*\))?$/m.test(first100Lines)) {
    if (lines.length <= 5) {
      return 'python';
    }
  }

  if (/\b(pd|np|plt|df)\.\w+\(/.test(code)) {
    return 'python';
  }

  if (/@(app|router|api)\.(route|get|post|put|delete|patch)/.test(code)) {
    return 'python';
  }

  if (/@(login_required|require_http_methods|permission_classes|csrf_exempt)/.test(code)) {
    return 'python';
  }

  if (/\bUser\.objects\.(filter|all|get|create|update|delete)/.test(code)) {
    return 'python';
  }

  if (/:\s*(str|int|bool|float|List|Dict|Tuple|Optional|Union|Any|Callable|Type|Sequence|Iterable)\b/.test(first100Lines)) {
    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
      if (/\bfrom\s+typing\s+import\b/.test(first100Lines) || /\bTypeVar\b/.test(first100Lines)) {
        return 'python';
      }
    }
  }

  if (/\bdef\s+(setup|draw)\s*\(\s*\):/.test(code)) {
    return 'python';
  }

  if (/^[\w-]+:\s*$/m.test(code) && /^\t/.test(code)) {
    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
      return 'python';
    }
    return null;
  }  if (!/[{}]/.test(code) && !/;/.test(code) && /\b(color|background|margin|padding|border|width|height)\s*:/.test(first100Lines)) {

    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines) || /\bfrom\s+typing\s+import\b/.test(first100Lines)) {
      return 'python';
    }
    return null;
  }

  if (/\bdef\s+\w+\s*\(/.test(first100Lines)) {

    if (/\bfor\s+\w+\s+in\s+/.test(code) || /\bif\s+.*:/.test(code) || /\bimport\s+\w+/.test(first100Lines)) {
      return 'python';
    }
  }

  if (/\b(defmodule|defp|def\s+\w+.*\s+do\b|use\s+[A-Z]|import\s+[A-Z]|alias\s+[A-Z])\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(extends\s+\w+|signal\s+\w+|export\s*\(|onready\s+var|func\s+_ready\(\))\b/.test(first100Lines)) {
    return null;
  }

  if (!/\b(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|if\s+.*:|elif\s+.*:|else:|print\(|lambda\s+|with\s+.*:|async\s+def|@\w+\s*\n\s*def)\b/.test(first100Lines)) {
    return null;
  }

  const pythonScore = (
    (/\b(def\s+\w+\s*\(|class\s+\w+\s*:)/.test(first100Lines) ? 2 : 0) +
    (/\b(self|__init__|__name__|__main__|None|True|False|range\(|append\(|len\()\b/.test(first100Lines) ? 2 : 0) +
    (/^(def|class|import|from)\s+/.test(firstLine) ? 1 : 0) +
    (lines.slice(0, 20).filter(l => /^\s{4}|\t/.test(l)).length > 2 ? 1 : 0) +
    (!hasCurlyBraces ? 1 : 0)
  );

  if (pythonScore >= 3) {
    return 'python';
  }

  return null;
};
