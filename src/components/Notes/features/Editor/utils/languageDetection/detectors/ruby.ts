import type { LanguageDetector } from '../types';

export const detectRuby: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, code, lines } = ctx;
  const hasRubyEnd = /\bend\b/.test(sample);

  if (
    /(?:^|\n)\s*(?:async\s+def|def)\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code) ||
    /(?:^|\n)\s*class\s+\w+(?:\([^)\n]*\))?\s*:/.test(code) ||
    /\byield\s+from\b/.test(code) ||
    /\blen\s*\(/.test(code) ||
    (/(?:^|\n)\s*@[a-z_]\w*(?:\.[a-z_]\w*)*(?:\([^)\n]*\))?\s*$/im.test(code) && /(?:^|\n)\s*def\s+\w+\s*\(/.test(code))
  ) {
    return null;
  }
  if (/^#include\s*[<"]/m.test(first100Lines) || /\bstd::/.test(code) || /\b(public|private|protected):\s*$/m.test(code) || /\btemplate\s*</.test(code) || /\b(enum\s+class|override|noexcept)\b/.test(code)) {
    return null;
  }


  // Simple single-line Ruby patterns
  if (lines.length <= 3) {
    // Ruby symbol assignment: status = :active
    if (/^\w+\s*=\s*:\w+$/.test(code.trim())) {
      return 'ruby';
    }
    
    if (/^puts\s+["']/.test(code.trim())) {
      // Check if it's NOT Crystal (no type annotations, no @property)
      if (!/:/.test(code) && !/@property/.test(code) && !/@\[/.test(code)) {
        return 'ruby';
      }
    }
  }

  if (/^#'/m.test(first100Lines)) {
    return null;
  }

  if (((/\b(?:const|let|var)\s+\w+\s*=/.test(first100Lines) || /(?:^|\n)\s*function\*?\s+\w+\s*\(/.test(code) || /\basync\s+function\b/.test(code) || /\bclass\s+\w+\s+extends\s+\w+/.test(code) || /\bstatic\s+\w+\s*\(/.test(code) || /#\w+\s*=/.test(code)) && (/=>/.test(code) || /;/.test(code) || /\bconsole\./.test(code))) || /\b(?:module\.exports|import\.meta|customElements\.define|structuredClone)\b/.test(code)) {
    return null;
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|interface\s+\w+|abstract\s+class)\b/.test(first100Lines)) {
    return null;
  }

  if (/^"\s*Vimball\s+Archiver/m.test(first100Lines) || /^UseVimball\s*$/m.test(first100Lines)) {
    return null;
  }

  if (/^class\s+\w+/m.test(first100Lines)) {
    if (
      /->|=>/.test(first100Lines) &&
      !/\bdef\s+\w+/.test(first100Lines) &&
      !/\b(scope|has_many|belongs_to|has_one|validates|before_save|after_create)\b/.test(code)
    ) {
      return null;
    }
  }

  if (/\b(defmodule|defp|def\s+\w+.*\s+do\b|use\s+[A-Z]|import\s+[A-Z])\b/.test(first100Lines)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function|data\.frame)\b/.test(first100Lines)) {
    return null;
  }

  if (/^#!.*crystal/.test(firstLine)) {
    return null;
  }
  if (/require\s+["'].*spec_helper["']/.test(first100Lines)) {
    return null;
  }
  if (/\b(assert_type|describe\s+["'].*\s+do|property\s+\w+|getter\s+\w+|setter\s+\w+)\b/.test(first100Lines) && /:\s*[A-Z]\w*/.test(first100Lines)) {
    return null;
  }

  if (/\bdef\s+\w+\s*\([^)]*\w+\s*:\s*[A-Z]\w*/.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+scala\.|object\s+\w+\s+extends|case\s+class|val\s+\w+\s*:\s*\w+|var\s+\w+\s*:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return null;
  }

  if (/\bUser\.(where|find|create|update|delete|all|first|last|includes)/.test(code)) {
    if (!/\.objects\./.test(code)) {
      return 'ruby';
    }
  }

  if (/\.(select|map|filter|reject)\s*\(&:/.test(code)) {
    return 'ruby';
  }

  if (/\bdefine_method\s*\(:/.test(code)) {
    return 'ruby';
  }

  if (/\.(where|order|limit|includes)\s*\(/.test(code) && /:\w+/.test(code)) {
    if (!/\bUser\.objects\./.test(code)) {
      return 'ruby';
    }
  }

  if (/\b(has_many|belongs_to|has_one|validates|before_save|after_create)\b/.test(code)) {
    return 'ruby';
  }

  // Rails ActiveRecord scopes and DSL (strong indicators)
  if (/\bscope\s+:\w+,\s*->/.test(code) ||
      /class\s+\w+\s*<\s*(ApplicationRecord|ActiveRecord::Base)/.test(code) ||
      /\bvalidates\s+:\w+,\s+(presence|uniqueness|length):/.test(code)) {
    return 'ruby';
  }

  // Rails dependent: :destroy pattern
  if (/has_many\s+:\w+,\s+dependent:\s*:destroy/.test(code)) {
    return 'ruby';
  }

  // Rails before_save, after_create callbacks
  if (/\b(before_save|after_create|before_validation|after_validation)\s+:\w+/.test(code)) {
    return 'ruby';
  }

  // Rails model with multiple associations (very strong indicator)
  if (/\b(has_many|belongs_to|has_one)\s+:\w+/.test(code)) {
    const associationCount = (code.match(/\b(has_many|belongs_to|has_one)\s+:/g) || []).length;
    if (associationCount >= 2) {
      return 'ruby';
    }
  }

  // Rails scope with lambda (very strong indicator)
  if (/\bscope\s+:\w+,\s*->\s*\{/.test(code)) {
    return 'ruby';
  }

  // Rails where clause in scope
  if (/\bscope\s+:\w+,\s*->\s*\{\s*where\(/.test(code)) {
    return 'ruby';
  }

  // Rails order with symbol
  if (/\border\s*\(\s*created_at:\s*:desc\s*\)/.test(code)) {
    return 'ruby';
  }

  if (/\.(select|map|filter|reject|each)\s*\{\s*\|\w+\|/.test(code)) {
    return 'ruby';
  }

  if (/\.\w+\s*\{\s*\|/.test(code)) {
    if (/\bend\b/.test(code) || /\}\s*\./.test(code)) {
      return 'ruby';
    }
  }

  if (firstLine.startsWith('# encoding:') || firstLine.startsWith('# frozen_string_literal:') || firstLine.startsWith('# typed:')) {
    return 'ruby';
  }

  if (/^require\s+/.test(first100Lines) || /^require_relative\s+/.test(first100Lines)) {
    if (/\b(module\s+\w+|class\s+\w+|def\s+\w+|end\b|attr_reader|attr_accessor|attr_writer)\b/.test(first100Lines)) {
      return 'ruby';
    }
  }

  if (/^require(?:_relative)?\s+['"]/.test(first100Lines)) {
    if (
      /\b(puts|warn|abort)\b/.test(code) ||
      /\b([A-Z]\w*\.new|Bundler\.require|CSV\.foreach|Date\.today|ERB\.new|File\.read|Gem::Specification\.new|JSON\.parse|Net::HTTP\.get|Open3\.capture3|OpenStruct\.new|OptionParser\.new|Pathname\.new|Set\.new|Shellwords\.split|Time\.now|URI\.parse|YAML\.load_file)\b/.test(code)
    ) {
      return 'ruby';
    }
  }

  if ((/^class\s+[A-Z]\w*/m.test(first100Lines) || /^module\s+[A-Z]\w*/m.test(first100Lines) || /^def\s+\w+[!?=]?/m.test(first100Lines)) && /\bend\b/.test(code)) {
    return 'ruby';
  }

  if (/\b(attr_reader|attr_accessor|attr_writer|delegate_missing_to|def_delegators|scope\s+:\w+,\s*->|has_many\s+:\w+|belongs_to\s+:\w+|has_one\s+:\w+|validates\s+:\w+|before_\w+\s+:\w+|after_\w+\s+:\w+|default_scope\s*\{|enum\s+\w+:\s*\{|serialize\s+:\w+|queue_as\s+:\w+|perform_later|deliver_later|FactoryBot\.define|RSpec\.describe|Minitest::Test|ApplicationRecord|ApplicationJob|ApplicationMailer|ApplicationController|Sidekiq::Worker|ActiveSupport::Concern|delegate\s+:\w+,\s+to:|params\.require\(|Gem::Specification\.new|namespace\s+:\w+\s+do|task\s+\w+:)\b/.test(code)) {
    return 'ruby';
  }

  if (/\b(rescue|ensure|unless|yield|public_send|send|destroy!|update!|create!|reload|constantize|module_function|prepend)\b/.test(code) || /\b(block_given\?|present\?|blank\?|empty\?|nil\?)/.test(code)) {
    return 'ruby';
  }

  if (/\b(Hash\.new|Struct\.new|Thread\.new|Mutex\.new|Queue\.new|Pathname\.new|OptionParser\.new|CSV\.foreach|ERB\.new|Open3\.capture3|File\.read|ENV\.fetch|Shellwords\.split|Rails\.cache\.fetch|OpenStruct\.new|JSON\.parse|YAML\.load_file|Set\.new|URI\.parse|Date\.today|Time\.now|Bundler\.require|Net::HTTP\.get)\b/.test(code)) {
    return 'ruby';
  }

  if (/\bcase\b/.test(code) && /\bwhen\b/.test(code) && /\bend\b/.test(code)) {
    return 'ruby';
  }

  if (/\bcase\b/.test(code) && /\bin\s+\{/.test(code) && /\bend\b/.test(code)) {
    return 'ruby';
  }

  if (/&\./.test(code)) {
    return 'ruby';
  }

  if (/<<~[A-Z][A-Z0-9_]*/.test(code) && /\bputs\b/.test(code)) {
    return 'ruby';
  }

  if (/->\s*\(/.test(code) && /\bputs\b/.test(code)) {
    return 'ruby';
  }

  if (/\b\d+\.(times|upto)\b/.test(code) && /\bdo\b/.test(code)) {
    return 'ruby';
  }

  if (/^\s*(get|post|put|patch|delete)\s+['"][^'"]+['"]\s+do\b/m.test(code)) {
    return 'ruby';
  }

  if (/\{\s*:\w+\s*=>/.test(code)) {
    return 'ruby';
  }

  if ((/\{\s*\w+:[ \t]+(?::\w+|['"]|\d+|true\b|false\b|nil\b|\{|\[)/.test(code) || /\[\s*:\w+\s*\]/.test(code)) && /:\w+/.test(code)) {
    return 'ruby';
  }

  if (/%w\[[^\]]+\](\.freeze)?/.test(code)) {
    return 'ruby';
  }

  if (/\bdescribed_class\b/.test(code) || /\b(format|warn|abort|system)\s*\(/.test(code) || /\.tap\s+do\s+\|[^|]+\|/.test(code) || /\.dig\(\s*:\w+/.test(code) || /\.fetch\(\s*:\w+/.test(code)) {
    return 'ruby';
  }

  if (/\{\s*\|[^|]+\|/.test(code) && /\b(Array\.new|map|select|reject|inject|tap|transform_values|group_by|sort_by|with_index)\b/.test(code)) {
    return 'ruby';
  }

  // Ruby block iteration
  if (/\.(each|map|select|reject|filter)\s+(do\s+\||\{)/.test(code)) {
    if (/\bend\b/.test(code) || /\}\s*$/.test(code)) {
      return 'ruby';
    }
  }

  if (/\b(describe|context|it|before|after)\s+['"]/.test(first100Lines) || /\b(describe|context)\s+\w+\s+do\b/.test(first100Lines)) {
    if (/\.should\b|expect\(/.test(first100Lines) || /\bdo\b/.test(first100Lines)) {
      return 'ruby';
    }
  }

  if (/\bsig\s*\{/.test(first100Lines)) {
    if (/\b(params|returns|void)\s*\(/.test(first100Lines) || /\bT\.(untyped|nilable)/.test(first100Lines)) {
      return 'ruby';
    }

    if (/\b(class|def)\s+\w+/.test(first100Lines)) {
      return 'ruby';
    }
  }

  if (/^module\s+\w+\s*$/m.test(first100Lines) || /^class\s+\w+\s*$/m.test(first100Lines)) {
    if (hasRubyEnd) {
      return 'ruby';
    }
  }

  if (/\b(attr_reader|attr_accessor|attr_writer)\s+:/.test(first100Lines)) {
    return 'ruby';
  }

  if (/\.(map|select|reject|filter|sort_by)\s*\(&:/.test(code)) {
    return 'ruby';
  }

  if (/\b(def\s+\w+|class\s+\w+\s*<|module\s+\w+|attr_accessor|attr_reader|attr_writer)\b/.test(first100Lines)) {
    if (hasRubyEnd &&
        (/\b(puts|print|gets|chomp|each|map|select|reject|nil\?|empty\?|require|include\s+\w+)\b/.test(first100Lines) ||
         /@\w+/.test(first100Lines))) {
      return 'ruby';
    }
  }

  if (!hasCurlyBraces && /\b(def|elsif|unless)\b/.test(first100Lines) && hasRubyEnd) {
    return 'ruby';
  }

  return null;
};
