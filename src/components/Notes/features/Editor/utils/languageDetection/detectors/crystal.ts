import type { LanguageDetector } from '../types';

export const detectCrystal: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
      /^package\s+[\w:]+;/m.test(first100Lines) ||
      (/^sub\s+\w+\s*\{/m.test(first100Lines) && /[\$@%][\w]+/.test(first100Lines))) {
    return null;
  }

  if (/\b(def\s+\w+|class\s+\w+|module\s+\w+)\b/.test(first100Lines)) {

    if (!/\b(require|lib|fun|property|getter|setter|describe|it|assert_type)\b/.test(first100Lines) &&
        !/:\s*[A-Z]\w*/.test(code) &&
        !/^#!.*crystal/.test(firstLine) &&
        !/#import\s+["<]/.test(first100Lines)) {
      return null;
    }
  }

  if (/^"\s*Vimball\s+Archiver/m.test(first100Lines) || /^UseVimball\s*$/m.test(first100Lines)) {
    return null;
  }

  if (/require\s+['"]/.test(first100Lines) && /->|=>/.test(code) && !/\bdef\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/#import\s+["<]/.test(first100Lines) && /\bNS[A-Z]\w+\s*\*/.test(first100Lines)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=|module\s+\w+|open\s+\w+|namespace\s+\w+)\b/.test(first100Lines) && /->/.test(code)) {

    if (!/\b(require|class|def|end|describe|it)\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/^#{1,6}\s+/.test(first100Lines) && !/\b(def|class|module)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(MACRO|ENDMACRO|SET|IF|ENDIF|FOREACH|ENDFOREACH)\(/.test(first100Lines)) {
    return null;
  }

  if (/\b(const|let|var)\s+\w+\s*=/.test(first100Lines) && /;/.test(first100Lines)) {
    return null;
  }

  if (/\bdef\s+\w+\s*\(.*\)\s*:/.test(first100Lines) && !/\bend\b/.test(code)) {
    return null;
  }

  if (/^#!.*crystal/.test(firstLine)) {
    return 'crystal';
  }

  if (/require\s+["'].*spec_helper["']/.test(first100Lines)) {
    return 'crystal';
  }

  if (/\bdescribe\s+["']/.test(code) && /\bit\s+["']/.test(code)) {

    if (/\b(run|to_i|to_f32|to_b|should|assert_type)\(/.test(code) ||
        /\.should\s+(eq|be_true|be_false|be_nil)/.test(code)) {
      return 'crystal';
    }
  }

  if (/\bassert_type\(/.test(code)) {
    return 'crystal';
  }

  if (/@\w+\s*::\s*[A-Z]\w*/.test(code) || /\w+\s*::\s*[A-Z]\w*/.test(code)) {

    if (/\b(def|class|module|require)\b/.test(code)) {
      return 'crystal';
    }
  }

  if (/:\s*[A-Z]\w*(\s*\|\s*[A-Z]\w*)*/.test(code)) {

    if (/\b(def|class|module|struct|enum|macro|lib|fun|alias|annotation)\b/.test(code)) {

      if (/\brequire\s+["']/.test(first100Lines) ||
          /\bproperty\s+\w+/.test(code) ||
          /\bgetter\s+\w+/.test(code) ||
          /\bsetter\s+\w+/.test(code) ||
          /\[\]\s+of\s+[A-Z]\w*/.test(code) ||
          /\bmodule\s+[A-Z]\w*$/m.test(first100Lines)) {
        return 'crystal';
      }
    }
  }

  if (/\bmacro\s+\w+/.test(code)) {
    return 'crystal';
  }

  if (/\blib\s+[A-Z]\w*/.test(code)) {
    if (/\bfun\s+\w+/.test(code)) {
      return 'crystal';
    }
  }

  if (/\b(property|getter|setter)\s+\w+/.test(code)) {
    return 'crystal';
  }

  if (/\.(to_i|to_f32|to_f64|to_b|to_s)\b/.test(code)) {

    if (/\b(def|class|module|require)\b/.test(code)) {
      return 'crystal';
    }
  }

  if (/\.should\s+(eq|be_true|be_false|be_nil)/.test(code)) {
    return 'crystal';
  }

  return null;
};
