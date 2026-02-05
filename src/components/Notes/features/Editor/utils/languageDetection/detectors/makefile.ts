import type { LanguageDetector } from '../types';

export const detectMakefile: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (/^---\s*$/m.test(code) || /^\.\.\.\s*$/m.test(code)) {
    return null;
  }

  if (/^(name|version|organization|scalaVersion|libraryDependencies)\s*(:=|\+=)/m.test(first100Lines)) {
    return null;
  }

  // Exclude Go code (strong Go indicators)
  if (/\bsync\.(WaitGroup|Mutex)/.test(first100Lines) ||
      /\bgo\s+func\s*\(/.test(first100Lines) ||
      /\bmake\s*\(\s*chan\s+/.test(first100Lines) ||
      /func\s+\w+\([^)]*\)\s+\([^)]*error\)/.test(first100Lines)) {
    return null;
  }

  // Exclude YAML (Docker Compose, Kubernetes)
  if (/^version:\s*['"]?\d+/.test(first100Lines) && /^services:/m.test(code)) {
    return null;
  }

  if (/\b(apiVersion|kind|metadata|spec):\s*/.test(first100Lines)) {
    return null;
  }

  if (/:=/.test(first100Lines)) {

    if (/^package\s+\w+$/m.test(code)) {
      return null;
    }

    if (/^\t/m.test(first100Lines) || (first100Lines.match(/:=/g) || []).length >= 2) {
      return 'makefile';
    }
  }

  if (/^(hint|path|define|symbol|cs|gc|opt|warning)\[?\w*\]?:/m.test(first100Lines)) {
    return null;
  }

  if (/^for\s+\w+\s*=\s*[\d:]+/m.test(first100Lines) &&
      /\b(linspace|zeros|ones|figure|pcolor|shading)\s*\(/.test(first100Lines)) {
    return null;
  }

  if (/^[\w-]+:\s*$/m.test(first100Lines)) {

    if (/\b(adapter|encoding|collation|database|pool|username|password|host|socket|reconnect):\s*/.test(first100Lines)) {
      return null;
    }
  }

  if (firstLine.startsWith('#!/usr/bin/make') || firstLine.startsWith('#!/bin/make')) {
    return 'makefile';
  }

  if (/^---\s*$/.test(firstLine) && /^uti:\s*com\./m.test(first100Lines)) {
    return null;
  }

  if (/\bpackage\s*=\s*["']|version\s*=\s*["']|source\s*=\s*\{/.test(code)) {
    return null;
  }

  if (/\b(function|local|return|end)\b/.test(first100Lines) && /--/.test(first100Lines)) {
    return null;
  }

  if (/\b(enum|class|struct|namespace|template|public|private|protected)\s+/.test(first100Lines) ||
      /#include\s*[<"]|#define\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(import|export|const|let|var|function|class)\s+/.test(first100Lines) && /[{}]/.test(first100Lines)) {
    return null;
  }

  if (/^(def|class|import|from)\s+/.test(firstLine) || /\b(def\s+\w+\s*\(|class\s+\w+\s*:)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bfrom\s+\w+\s+import\b/.test(first100Lines) || /\bimport\s+\w+/.test(first100Lines)) {

    if (/\b(def\s+\w+|class\s+\w+|if\s+__name__|print\(|range\()\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(require|module\s+\w+|class\s+\w+\s*<|def\s+\w+)\b/.test(first100Lines) && /\bend\b/.test(code)) {
    return null;
  }

  if (/^use\s+(strict|warnings|v\d+)/.test(first100Lines) || /^package\s+\w+;/.test(first100Lines)) {
    return null;
  }

  if (/^[\w-]+:\s*$/.test(firstLine) && /^\s{2,}\w+:/.test(first100Lines)) {
    return null;
  }

  if (/^\[[\w.-]+\]\s*$/m.test(code)) {
    return null;
  }

  if (/^[\w]+\s*=\s*->/.test(first100Lines) ||
      /^[\w]+:\s*->/.test(first100Lines) ||
      /^task\s+['"]/.test(first100Lines)) {
    return null;
  }

  if (/\b(module\s+\w+\s+exposing|import\s+\w+\s+exposing)\b/.test(first100Lines)) {
    return null;
  }

  if (/^(set|let|function|if|endif|colorscheme)\s+/.test(first100Lines)) {
    return null;
  }

  if (/^"\s*Vimball\s+Archiver/m.test(first100Lines) || /^UseVimball\s*$/m.test(first100Lines)) {
    return null;
  }

  // Variable assignments (KEY = value)
  if (/^[A-Z_a-z][\w-]*\s*[:?]?=/m.test(code)) {
    // Exclude Julia array operations
    if (/\.\^/.test(code) || /\[[\d\s]+;[\d\s]+\]/.test(code)) {
      return null;
    }

    // Exclude Python list comprehensions and operations
    if (/\[[\s\S]*?\bfor\s+\w+\s+in\s+[\s\S]*?\]/.test(code) || /\*\*\d+/.test(code)) {
      return null;
    }

    // Exclude MATLAB scripts
    if (/^%\s/m.test(code) && /\b(eig|plot|zeros|ones|rand|randn|figure|title|xlabel|ylabel)\s*\(/.test(code)) {
      return null;
    }

    // Exclude Stylus (CSS-like with variables)
    if (/#[0-9a-fA-F]{3,6}\b/.test(code) && /\b(color|background|padding|margin|font-size|border)\b/.test(code)) {
      return null;
    }

    const varMatches = code.match(/^[A-Z_a-z][\w-]*\s*[:?]?=/gm);
    if (varMatches && varMatches.length >= 2) {

      if (/\+=|%%|Seq\(/.test(code)) {
        return null;
      }

      if (/->|=>/.test(code)) {
        return null;
      }

      const sample = code.slice(0, 1000);
      if (/\{/.test(sample) && /["']/.test(sample) && /function|local|return/.test(sample)) {

        return null;
      }

      if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
        return null;
      }
      return 'makefile';
    }
  }

  // Target rules (key: value or key:)
  if (/^[\w./-]+:\s*[\w./-]*\s*\\?$/m.test(code)) {
    // Exclude YAML files (check for YAML-specific keywords)
    if (/\b(apiVersion|kind|metadata|spec|selector|matchLabels):\s*/.test(first100Lines)) {
      return null;
    }

    if (/\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
      return null;
    }

    if (/^\t/m.test(code) || /\\\s*$/m.test(code)) {
      return 'makefile';
    }

    const targets = code.match(/^[\w./-]+:/gm);
    if (targets && targets.length >= 2) {
      return 'makefile';
    }
  }

  if (/%[\w.-]+:\s*%[\w.-]+/.test(code)) {
    return 'makefile';
  }

  if (/\$\([A-Z_a-z]+\)|\.PHONY:|^all:|^clean:|^install:/m.test(code)) {
    return 'makefile';
  }

  if (/\$\(wildcard\s+|\$\(shell\s+|\$\(patsubst\s+/.test(code)) {
    return 'makefile';
  }

  return null;
};
