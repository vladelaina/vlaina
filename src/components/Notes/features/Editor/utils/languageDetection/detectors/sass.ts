import type { LanguageDetector } from '../types';

export const detectSass: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/@[\w-]+:\s*#[0-9a-fA-F]{3,6};/.test(code) && /darken\s*\(@[\w-]+/.test(code)) {
    return null;
  }

  // Simple single-line SCSS variable: $primary-color: #007bff;
  if (ctx.lines.length <= 3) {
    const trimmed = code.trim();
    if (/^\$[\w-]+:\s*#[0-9a-fA-F]{3,6};?$/.test(trimmed)) {
      return 'scss';
    }
    if (/^\$[\w-]+:\s*[^;]+;?$/.test(trimmed)) {
      // Make sure it's not PowerShell or Perl
      if (!/\b(param|Get-|Set-|my\s+\$|sub\s+)\b/.test(code)) {
        return 'scss';
      }
    }
  }

  if (/#include\s*[<"]/.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+|part\s+['"])\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(const\s+std\s*=\s*@import|pub\s+fn\s+main|@import\(["']std["']\))\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(type\s+\w+\s*\{|query\s+\w+|mutation\s+\w+|schema\s*\{)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(module\s+\w+\s+where|import\s+qualified|data\s+\w+\s*=|type\s+\w+\s*=|instance\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+(Foundation|UIKit|SwiftUI)|func\s+\w+\s*\(|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (!/[{}]/.test(code) && !/;/.test(code) && !/\$[\w-]+:/.test(code)) {
    return null;
  }

  if (/\$[\w-]+\s*=\s*/.test(first100Lines) && /\b(param|function|Get-|Set-|New-|Remove-|Write-Host|Write-Output)\b/i.test(first100Lines)) {
    return null;
  }

  if (/\$[\w-]+\s*=\s*/.test(first100Lines) && /\b(use\s+strict|use\s+warnings|my\s+\$|sub\s+\w+|package\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/@define-mixin\b/.test(code)) {
    return null;
  }

  if (/\{[\s\S]*?\}/.test(code) && /;/.test(code)) {

    if (/\$[\w-]+:\s*[^;]+;/.test(code)) {

      if (/&:(hover|focus|active|before|after|first-child|last-child)/.test(code) || /&--\w+/.test(code) || /&\.\w+/.test(code)) {
        return 'scss';
      }

      if (/\b(darken|lighten|saturate|desaturate|adjust-hue|rgba|mix)\s*\(/.test(code)) {
        return 'scss';
      }

      if (/\b(color|background|margin|padding|border|width|height|display|position|font-size|font-family)\s*:/.test(code) ||
          /@(mixin|include|extend|import|use|forward)\b/.test(code)) {
        return 'scss';
      }
    }
  }

  if (/\$[\w-]+:\s*[^;]+;/.test(code) && (/&/.test(code) || /\bdarken\(/.test(code))) {
    return 'scss';
  }

  if (/&:(hover|focus|active|before|after)/.test(code) && /\{[\s\S]*?\}/.test(code)) {
    return 'scss';
  }

  if (/\bdarken\s*\(\s*\$\w+/.test(code)) {
    return 'scss';
  }

  if (!/[{}]/.test(code) && !/;/.test(code)) {

    if (/^\$[\w-]+:/m.test(code) || /^@mixin|^@include|^\+\w+/m.test(code)) {
      return 'sass';
    }
  }

  return null;
};
