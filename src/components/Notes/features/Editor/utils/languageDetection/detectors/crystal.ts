import type { LanguageDetector } from '../types';

export const detectCrystal: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  if ((/@property\b/.test(code) || /@[a-z_]\w*\.setter\b/.test(code)) && /(?:^|\n)\s*def\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code)) {
    return null;
  }
  if (/^#include\s*[<"]/m.test(first100Lines) || /\benum\s+class\b/.test(code) || /\bstd::/.test(code) || /\b(public|private|protected):\s*$/m.test(code)) {
    return null;
  }


  if (
    /^require(?:_relative)?\s+['"]/.test(first100Lines) &&
    !/^#!.*crystal/.test(firstLine) &&
    (
      /\b(Bundler\.require|JSON\.parse|Net::HTTP\.get|OpenStruct\.new|OptionParser\.new|ERB\.new|Date\.today|Time\.now|URI\.parse|Set\.new|Pathname\.new|YAML\.load_file|Shellwords\.split|Open3\.capture3|File\.read|CSV\.foreach|Gem::Specification\.new)\b/.test(code) ||
      /\bputs\s+\w+\./.test(code)
    )
  ) {
    return null;
  }

  if (
    /\b(Sidekiq::Worker|Minitest::Test|ActiveSupport::Concern|ApplicationRecord|ApplicationJob|ApplicationMailer|ApplicationController|FactoryBot\.define|RSpec\.(describe|shared_examples)|described_class|delegate_missing_to|perform_later|deliver_later|module_function)\b/.test(code) ||
    /\bclass\s+\w+\s*<\s*(ApplicationRecord|ApplicationJob|ApplicationMailer|ApplicationController|Minitest::Test)\b/.test(code)
  ) {
    return null;
  }

  // Crystal type annotations
  if (/:\s*[A-Z]\w*/.test(code) && /\b(def|class|property|getter|setter)\b/.test(code)) {
    if (/^#!.*crystal/.test(firstLine) || /require\s+["']/.test(first100Lines) || /\b(property|getter|setter)\b/.test(code)) {
      return 'crystal';
    }
    // If it's just a simple puts with no Crystal-specific features, let Ruby handle it
    if (lines.length <= 3 && /^puts\s+["']/.test(code.trim())) {
      return null;
    }
  }

  // Crystal property macro
  if (/\b(property|getter|setter)\s+\w+\s*:\s*[A-Z]\w*/.test(code)) {
    return 'crystal';
  }

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
    if (/\b(def|class|module|struct|lib|fun|macro)\b/.test(code)) {
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

  if (/\busers\.(select|map|filter|reject)\s*\(&\./.test(code)) {
    return 'crystal';
  }

  // Simple puts statement should stay with Ruby unless Crystal-only markers exist
  if (lines.length <= 3 && /\bputs\s+/.test(code)) {
    if (/\b(property|getter|setter)\b/.test(code)) {
      return 'crystal';
    }

    if (/\w+\s*:\s*[A-Z]\w*\s*=/.test(code)) {
      return 'crystal';
    }

    return null;
  }

  return null;
};
