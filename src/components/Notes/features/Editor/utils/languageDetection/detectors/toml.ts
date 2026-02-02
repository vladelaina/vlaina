import type { LanguageDetector } from '../types';

export const detectTOML: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^(version|author|description|license|srcDir|binDir|skipDirs)\s*=/m.test(code)) {
    if (/\brequires\s+["']|^task\s+\w+,/m.test(code)) {
      return null;
    }
  }

  if (/\bpackage\s*=\s*["']/.test(first100Lines) && /\bsource\s*=\s*\{/.test(first100Lines)) {
    return null;
  }

  if (/<template>|<script>|<style>/.test(first100Lines)) {
    return null;
  }

  if (/^import\s+.*from\s+['"]/.test(first100Lines) && /^#\s+/.test(first100Lines)) {
    return null;
  }

  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return null;
  }

  if (/^[\w]+\s*=\s*->/.test(first100Lines) || /^[\w]+:\s*->/.test(first100Lines)) {
    return null;
  }

  if (/^(def|class|import|from)\s+/.test(firstLine) || /\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(function\s+\w+\s*\(|end\b|using\s+\w+|module\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(function\s+.*=\s*\w+\s*\(|end\b)\b/.test(first100Lines) && /%/.test(first100Lines)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=|module\s+\w+\s*=|open\s+\w+|type\s+\w+\s*=)\b/.test(first100Lines)) {
    return null;
  }

  if (/^\[[\w.-]+\]\s*$/m.test(code)) {
    return 'toml';
  }

  if (/^[\w.-]+\s*=\s*.+$/m.test(code)) {

    if (/\[\[.*\]\]|"""/.test(code)) {
      return 'toml';
    }

    const matches = code.match(/^[\w.-]+\s*=/gm);
    if (matches && matches.length >= 3) {

      if (!/\b(function|def|class|module|import|require|use|package)\b/.test(first100Lines)) {
        return 'toml';
      }
    }
  }

  return null;
};
