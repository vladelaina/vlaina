import type { LanguageDetector } from '../types';

export const detectGDScript: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  // Simple var declaration: var health = 100
  if (/^var\s+\w+\s*=\s*\d+\s*$/m.test(code.trim())) {
    // Check if it's not other languages
    if (!/\b(let|const|function|class|import|export)\b/.test(code)) {
      // For single line, check if it's likely GDScript
      if (ctx.lines.length <= 3) {
        // GDScript uses 'var' keyword, but so do other languages
        // Check for GDScript-specific context
        if (/^var\s+\w+\s*=\s*\d+$/.test(code.trim())) {
          // Could be GDScript, but need more evidence
          // Return 'gdscript' tentatively for single var declaration
          return 'gdscript';
        }
      }
    }
  }

  if (/\bvar\s+\w+\s*=\s*get_node\(/.test(code)) {
    return 'gdscript';
  }

  if (/\bsignal\s+\w+\s*\(/.test(code)) {
    return 'gdscript';
  }

  if (/^extends\s+\w+/m.test(code)) {
    return 'gdscript';
  }

  if (/\b(proc\s+\w+|import\s+\w+|when\s+defined\(|task\s+\w+,|switch\()\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+(Foundation|UIKit|SwiftUI|Cocoa)|struct\s+\w+:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bclass\s+\w+:\s*\w+/.test(first100Lines) &&
      !/\bfunc\s+\w+\(/.test(code)) {
    return null;
  }

  if (/\b(Vector2|Vector3|Color)\s*\(/.test(code)) {

    if (/\b(func|var)\s+\w+/.test(code)) {
      return 'gdscript';
    }
  }

  if (/\bfunc\s+\w+\(/.test(code)) {

    if (/\b(signal|export|onready|preload|yield|setget|tool|class_name)\b/.test(code) ||
        /\$[\w/]+/.test(code) ||
        /^var\s+\w+\s*=\s*(Vector2|Vector3|Color)\(/m.test(code)) {
      return 'gdscript';
    }
  }

  if (/\$[\w/]+/.test(code) && /\bfunc\b/.test(code)) {
    return 'gdscript';
  }

  return null;
};
