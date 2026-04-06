import type { LanguageDetector } from '../types';

export const detectCMake: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (/^---\s*$/.test(firstLine)) {

    if (/^uti:\s*com\./m.test(first100Lines) || /^#{1,6}\s+/m.test(first100Lines)) {
      return null;
    }
  }

  if (/^"\s/m.test(first100Lines) ||
      /\b(filetype\s+(on|off|plugin)|syntax\s+(on|off|enable)|Plugin\s+["']|call\s+\w+#|fun!?\s+\w+|endfun|colorscheme\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bvar\s+\w+\s*=/.test(first100Lines) ||
      /\bfunction\s+\w+\s*\(/.test(first100Lines) ||
      /\bObject\.(defineProperty|create|setPrototypeOf)/.test(first100Lines)) {
    return null;
  }

  if (/\b(?:const|let|var)\s+\w+\s*:\s*Set<[^>\n]+>\s*=/.test(code) || /\bnew\s+Set\s*\(/.test(code)) {
    return null;
  }

  if (/\b(cmake_minimum_required|project|add_executable|add_library|target_link_libraries|find_package|find_library|include_directories|set|option|enable_testing|add_custom_command)\s*\(/i.test(code)) {
    return 'cmake';
  }

  if (/\b(MACRO|ENDMACRO|FUNCTION|ENDFUNCTION|IF|ENDIF|FOREACH|ENDFOREACH|WHILE|ENDWHILE)\s*\(/i.test(code)) {
    if (/\b(SET|CMAKE_|CHECK_)\b/i.test(code)) {
      return 'cmake';
    }
  }

  if (/\$\{[\w_]+\}/.test(code) && /CMAKE_|PROJECT_/.test(code)) {
    return 'cmake';
  }

  return null;
};
