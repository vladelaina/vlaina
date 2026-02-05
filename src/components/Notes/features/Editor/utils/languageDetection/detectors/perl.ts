import type { LanguageDetector } from '../types';

export const detectPerl: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  // Simple single-line Perl patterns
  if (lines.length <= 3) {
    if (/^print\s+["'].*["']\s*;/.test(code.trim())) {
      return 'perl';
    }
  }

  // Perl regex matching
  if (/\$\w+\s*=~\s*\//.test(code) || /\bif\s*\(\s*\$\w+\s*=~/.test(code)) {
    return 'perl';
  }

  if (/\[package\]/.test(code) && /\bname\s*=\s*["']/.test(code) && /\bversion\s*=\s*["']/.test(code)) {
    return null;
  }

  if (/\bvar\s+\w+\s*=/.test(first100Lines) ||
      /\bfunction\s+\w+\s*\(/.test(first100Lines) ||
      /\bObject\.(defineProperty|create|setPrototypeOf)/.test(first100Lines)) {
    return null;
  }

  if (/\b(set\s+(encoding|filetype|syntax|background|colorscheme|number|autoread|backspace|tabstop|hlsearch|ignorecase|incsearch|modelines|showmatch|laststatus|statusline|rtp)|filetype\s+(on|off|plugin)|syntax\s+(on|off|enable)|Plugin\s+["']|call\s+\w+#|fun!?\s+\w+|endfun)\b/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+;/m.test(code) && /\./.test(code.match(/^package\s+([\w.]+);/m)?.[1] || '')) {
    return null;
  }
  if (/^import\s+java\./m.test(code)) {
    return null;
  }

  if (/^\{application,\s*\w+,/m.test(code) || /^%.*-\*-\s*erlang\s*-\*-/m.test(first100Lines)) {
    return null;
  }

  if (/^function\s+\w+/.test(first100Lines) && /\$[\w]+/.test(first100Lines)) {
    if (/\$global:|@\{|@\(|\[datetime\]|\[array\]|\[string\]/.test(code) ||
        /\b(Get|Set|New|Remove|Add)-[A-Z]\w+/.test(code)) {
      return null;
    }
  }

  if (/^---\s*$/m.test(first100Lines) && /^uti:\s*com\./m.test(first100Lines)) {
    return null;
  }

  if (/\bdef\s+\w+/.test(first100Lines)) {
    if (/\b(Picture|trans|rot|scale|GPics|drawing|stem)\b/.test(code) ||
        /\bdef\s+\w+\s*\(.*\)\s*:\s*\w+/.test(first100Lines)) {
      return null;
    }
  }

  if (/#import\s+["<]/.test(first100Lines)) {
    return null;
  }

  if (/require\s+['"]/.test(first100Lines) && /->|=>/.test(code)) {
    return null;
  }

  if (/^\(ns\s+[\w.-]+|^\((def|defn|defmacro|deftask)\s+/m.test(first100Lines)) {
    return null;
  }
  if (/^;;/.test(first100Lines) && /^\(/m.test(first100Lines)) {
    return null;
  }

  if (/\b(proc\s+\w+|import\s+\w+|when\s+defined\(|task\s+\w+,|switch\()\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(import|export)\s+.*\s+from\s+['"]/.test(first100Lines)) {
    return null;
  }

  if (/\b(fn\s+\w+|impl\s+\w+|use\s+std::)\b/.test(first100Lines)) {
    return null;
  }

  if (/^-(module|export|include)\(/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w:]+;/m.test(code)) {
    return 'perl';
  }

  if (/^use\s+(strict|warnings|v\d+|base|parent|constant|lib|feature)/m.test(code)) {
    return 'perl';
  }

  if (/[\$@%][\w]+/.test(code)) {

    if (/\b(use|package|sub|my|our|local|foreach|unless|elsif)\b/.test(code)) {
      return 'perl';
    }
  }

  // Perl regex operators (=~ s/ or =~ m/)
  if (/=~\s*[sm]\//.test(code)) {
    if (/\$\w+\s*=~\s*s\//.test(code)) {
      return 'perl';
    }
    if (/<[a-z]+\s+[^>]*>/.test(code) && !/\b(use|package|sub|my|our|local|[\$@%]\w+)\b/.test(code)) {
      return null;
    }
    if (/\b(use|package|sub|my|our|local)\b/.test(code) || /[\$@%]\w+/.test(code)) {
      return 'perl';
    }
    return 'perl';
  }

  if (/^sub\s+\w+\s*\{/m.test(code)) {

    if (/[\$@%][\w]+|use\s+\w+|my\s+\w+/.test(code)) {
      return 'perl';
    }
  }

  return null;
};
