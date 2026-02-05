import type { LanguageDetector } from '../types';

export const detectElixir: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^"\s/m.test(first100Lines) &&
      (/\b(function!|endfunction|set\s+\w+|colorscheme|autocmd|let\s+[gbslwtav]:)\b/.test(first100Lines))) {
    return null;
  }

  if (/^class\s+\w+|^module\s+\w+\s*$/m.test(first100Lines)) {
    if (/\bend\b/.test(code) && !/\bdefmodule\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/@\w+/.test(first100Lines) || /sig\s*\{/.test(first100Lines)) {
    if (!/\bdefmodule\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/^#!.*crystal/.test(firstLine)) {
    return null;
  }
  if (/require\s+["'].*spec_helper["']/.test(first100Lines)) {
    return null;
  }

  if (/^defmodule\s+[A-Z][\w.]*\s+do$/m.test(first100Lines)) {
    return 'elixir';
  }

  if (/@(moduledoc|doc|spec|type|callback|behaviour|impl)\b/.test(first100Lines)) {
    if (/\b(defmodule|def|defp)\b/.test(first100Lines)) {
      return 'elixir';
    }
  }

  if (/\b(defmodule|defp|def|defmacrop|defmacro|defstruct|defprotocol|defimpl)\s+\w+.*\s+do\b/.test(first100Lines)) {
    return 'elixir';
  }

  if (/\b(use|import|alias|require)\s+[A-Z][\w.]*/.test(first100Lines)) {
    if (/\b(def|defp|defmodule)\b/.test(code)) {
      return 'elixir';
    }
  }

  // Elixir case/pattern matching
  if (/\bcase\s+\w+\s+do\b/.test(code)) {
    if (/\{:ok,\s*\w+\}\s*->/.test(code) || /\{:error,\s*_\}\s*->/.test(code)) {
      return 'elixir';
    }
  }

  if (/\b(Enum|String|List|Map|Tuple|Agent|Task|GenServer|Supervisor)\.[a-z_]+\(/.test(code)) {
    return 'elixir';
  }

  if (/\bwith\s+\{:ok,\s*\w+\}\s*<-/.test(code)) {
    return 'elixir';
  }

  if (/\|>/.test(code)) {
    if (/\b(def|defp|defmodule)\b/.test(code)) {
      return 'elixir';
    }
  }

  if (/:\w+/.test(code) && /\b(def|defmodule)\b/.test(code)) {
    if (/\bend\b/.test(code)) {
      return 'elixir';
    }
  }

  return null;
};
