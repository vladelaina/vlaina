import type { LanguageDetector } from '../types';

export const detectTOML: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  if (/^\s*@import\s+\w+/m.test(first100Lines) ||
      /#import\s+[<"]/m.test(first100Lines) ||
      /@(interface|implementation|protocol|property|selector|autoreleasepool|dynamic|synthesize)\b/.test(code) ||
      /\b(?:NS|UI|CF)[A-Z]\w*(?:<[^>\n]+>)?\s*\*/.test(code) ||
      /\[\s*(?:\[[^\]]+\]|self|super|[A-Z]\w*|\w+)\s+\w+/.test(code)) {
    return null;
  }

  if (
    /\b(?:None|True|False|Literal)\b/.test(code) ||
    /\b(?:len|sum|min|max|any|all|enumerate|zip|sorted|range|isinstance|print)\s*\(/.test(code) ||
    /\.(?:get|setdefault|append|extend|pop|appendleft|exists|read_text|write_text|unlink|getenv|loads|join|now)\s*\(/.test(code) ||
    /(?:^|\n)\s*\w+(?:\s*,\s*\*?\w+)+\s*=/.test(code) ||
    /\[[^\]\n]*:[^\]\n]*\]/.test(code) ||
    /^require(?:_relative)?\s+['"]/.test(first100Lines) ||
    /\b(attr_reader|attr_accessor|attr_writer|module_function|delegate_missing_to|described_class|Sidekiq::Worker|Minitest::Test|ActiveSupport::Concern|Bundler\.require|Gem::Specification\.new)\b/.test(code) ||
    /\b(puts|warn|abort|format)\s*\(/.test(code) ||
    /\b\d+\.(times|upto)\b/.test(code) ||
    /\{\s*:\w+\s*=>/.test(code)
  ) {
    return null;
  }

  if (/^[A-Za-z_][\w-]*\s*=\s*["'].*["']/m.test(first100Lines) && /\b(printf|echo|grep|sed|awk|find)\b/.test(code) && code.includes('$')) {
    return null;
  }

  // Simple single-line TOML patterns: [server] or host = "localhost"
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // TOML section header: [server]
    if (/^\[[\w.-]+\]\s*$/.test(trimmed)) {
      return 'toml';
    }
    // Multiple lines with section and key-value
    if (/^\[[\w.-]+\]\s*\n[\w-]+\s*=/.test(code)) {
      return 'toml';
    }
    // TOML key-value: host = "localhost"
    if (/^[\w-]+\s*=\s*["']/.test(trimmed)) {
      if (!/\{|\}|;|function|class|def|import|package|:/.test(code)) {
        return 'toml';
      }
    }
    if (/^[\w-]+\s*=\s*(true|false)\s*$/i.test(trimmed)) {
      return 'toml';
    }
    // TOML key-value with number: port = 8080
    if (/^[\w-]+\s*=\s*\d+\s*$/.test(trimmed)) {
      return 'toml';
    }
  }

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

  // Exclude CoffeeScript (has arrow functions)
  if (/->|=>/.test(first100Lines)) {
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
    if ((/\bname\s*=\s*["']/.test(code) && /\bversion\s*=\s*["']/.test(code)) || /\bauthors\s*=\s*\[/.test(code) || /\[package\]/.test(code)) {
      return 'toml';
    }
  }

  if (/\[package\]\s*\n\s*name\s*=/.test(code)) {
    return 'toml';
  }

  if (/\[package\]/.test(code) && /\bname\s*=\s*["']/.test(code) && /\bversion\s*=\s*["']/.test(code)) {
    return 'toml';
  }

  if (/^[\w.-]+\s*=\s*.+$/m.test(code)) {

    // Exclude Julia vectorized operations (.^, .+, .*, etc.)
    if (/\.\^|\.\+|\.\*|\.\//.test(code)) {
      return null;
    }

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
