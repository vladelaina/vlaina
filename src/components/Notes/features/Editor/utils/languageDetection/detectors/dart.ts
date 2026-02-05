import type { LanguageDetector } from '../types';

export const detectDart: LanguageDetector = (ctx) => {
  const { first100Lines, hasCurlyBraces, hasSemicolon, code, lines } = ctx;

  // Simple single-line Dart patterns
  if (lines.length <= 3) {
    if (/^void\s+main\s*\(\s*\)\s*\{/.test(code.trim())) {
      // Dart uses single quotes for strings
      if (/print\s*\(['"]/.test(code)) {
        return 'dart';
      }
    }
  }

  // Dart main function (must be before PHP check)
  if (/\bvoid\s+main\s*\(\s*\)\s*\{/.test(first100Lines)) {
    if (/\bprint\s*\(/.test(first100Lines)) {
      return 'dart';
    }
  }

  // Dart class definition
  if (/^class\s+\w+\s*\{/m.test(code)) {
    if (/\b(String|int|double|bool|var|final|const)\s+\w+;/.test(code)) {
      if (/\b\w+\(this\.\w+/.test(code)) {
        return 'dart';
      }
    }
  }

  if (/\b(final|const)\s+\w+\s*=\s*await\s+/.test(first100Lines)) {
    if (/\bFirebaseFirestore\.instance/.test(first100Lines) || /\bWidget\s+build/.test(first100Lines)) {
      return 'dart';
    }
  }

  if (/\bFirebaseFirestore\.instance/.test(first100Lines)) {
    return 'dart';
  }

  if (/\bWidget\s+build\s*\(\s*BuildContext/.test(first100Lines)) {
    return 'dart';
  }

  // Flutter StatefulWidget/StatelessWidget (very strong indicator)
  if (/class\s+\w+\s+extends\s+(StatefulWidget|StatelessWidget)/.test(code)) {
    return 'dart';
  }

  // Flutter State class (very strong indicator)
  if (/class\s+_\w+State\s+extends\s+State<\w+>/.test(code)) {
    return 'dart';
  }

  // Flutter widgets and methods (strong indicator)
  if (/@override\s+Widget\s+build/.test(code) ||
      /\b(setState|initState|dispose|didUpdateWidget)\s*\(/.test(code)) {
    return 'dart';
  }

  // Flutter widget tree patterns (very strong indicator)
  if (/\b(Scaffold|AppBar|ListView\.builder|TextField|IconButton)\s*\(/.test(code)) {
    if (/\bWidget\s+build/.test(code) || /\bStatefulWidget\b/.test(code)) {
      return 'dart';
    }
  }

  // Dart import package:flutter (very strong indicator)
  if (/^import\s+['"]package:flutter\//.test(first100Lines)) {
    return 'dart';
  }

  // Flutter Scaffold with AppBar
  if (/\bScaffold\s*\(/.test(code) && /\bappBar:\s*AppBar\s*\(/.test(code)) {
    return 'dart';
  }

  // Flutter ListView.builder
  if (/\bListView\.builder\s*\(/.test(code) && /\bitemBuilder:\s*\(/.test(code)) {
    return 'dart';
  }

  // Flutter EdgeInsets
  if (/\bEdgeInsets\.(all|symmetric|only)\s*\(/.test(code)) {
    return 'dart';
  }

  // Flutter Icon with Icons
  if (/\bIcon\s*\(\s*Icons\.\w+/.test(code)) {
    return 'dart';
  }

  // Flutter imports
  if (/^import\s+['"]package:flutter\/material\.dart['"];?/m.test(first100Lines)) {
    return 'dart';
  }

  if (/\b(Scaffold|AppBar|Text|Container|Column|Row|ListView)\s*\(/.test(first100Lines)) {
    if (/\b(final|const|var)\s+\w+/.test(first100Lines)) {
      return 'dart';
    }
  }

  if (/\bfinal\s+\w+\s*=\s*\w+\.where\s*\(\s*\(\w+\)\s*=>/.test(code)) {
    if (/\.toList\(\)/.test(code)) {
      return 'dart';
    }
  }

  if (/\bStream<\w+>\s+\w+\s*\([^)]*\)\s+async\*/.test(code)) {
    return 'dart';
  }

  if (/\bextension\s+\w+\s+on\s+\w+/.test(code)) {
    return 'dart';
  }

  if (/\b(import\s+['"]dart:|import\s+['"]package:)\b/.test(first100Lines)) {
    return 'dart';
  }

  if (/\b(library\s+\w+;|part\s+of\s+['"]|part\s+['"])\b/.test(first100Lines)) {
    return 'dart';
  }

  if (/@dart\s*=/.test(first100Lines) || /\/\/\s*dart\s+format/.test(first100Lines)) {
    return 'dart';
  }

  if (!hasCurlyBraces || !hasSemicolon) {
    return null;
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|console\.|alert\()\b/.test(first100Lines)) {
    return null;
  }

  if (/\bclass\s+\w+\s+extends\s+\$\w+/.test(first100Lines)) {
    return 'dart';
  }

  if (/\b(void\s+main|@override)\b/i.test(first100Lines)) {
    if (/\b(Future<|Stream<|final\s+\w+|const\s+\w+|dynamic\s+\w+)\b/.test(first100Lines)) {
      return 'dart';
    }
  }

  return null;
};
