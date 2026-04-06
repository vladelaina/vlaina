import type { LanguageDetector } from '../types';

export const detectSwift: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  if (/^\s*@import\s+(Foundation|UIKit|CoreFoundation|CFNetwork)\s*;/m.test(first100Lines) ||
      /@(interface|implementation|protocol|property|dynamic|synthesize|selector|autoreleasepool|synchronized)\b/.test(code)) {
    return null;
  }

  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^package\s+\w+$/m.test(first100Lines) || /^import\s+java\./m.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|module\.exports|require\()\b/.test(first100Lines) ||
      /\b(?:const|let|var)\s+\w+\s*=\s*async\s*\(/.test(code) ||
      /\basync\s+function\b/.test(code) ||
      /(?:^|\n)\s*function\*?\s+\w+\s*\(/.test(code) ||
      /\bconsole\.(log|error|warn|info|table)\b/.test(code) ||
      /\bconst\s+\w+\s*=/.test(code) ||
      /=>/.test(code) ||
      /\breturn\s+await\s+fetch\(/.test(code) ||
      /\bPromise<[^>]+>/.test(code) ||
      /\bimport\.meta\b/.test(code) ||
      /constructor\(\s*private\s+\w+/.test(code) ||
      /^type\s+\w+\s+struct\s*\{/m.test(code)) {
    return null;
  }

  if (/^extends\s+\w+/m.test(first100Lines)) {
    return null;
  }

  if (/^#(include|define|ifdef|ifndef|elif|else|endif)\b/m.test(first100Lines) ||
      /\btypedef\s+(struct|enum|union)\b/.test(first100Lines) ||
      /\b(restrict|volatile|extern)\b/.test(code) ||
      /\bdo\s*\{[\s\S]*\}\s*while\s*\(/.test(code) ||
      /\b(?:int|char|float|double|short|long|unsigned|signed|void)\s+\**\w+\s*\([^)]*\)\s*\{/.test(code)) {
    return null;
  }

  if (/^import\s+(Foundation|UIKit|SwiftUI|Combine)\b/m.test(first100Lines)) {
    return 'swift';
  }

  if (/(?:^|\n)\s*enum\s+\w+(?:\s*:\s*[^\{\n]+)?\s*\{/m.test(code) && /(?:^|\n)\s*case\s+\w+(?:\([^\)\n]*\))?/m.test(code)) {
    return 'swift';
  }

  let score = 0;

  if (/@(?:MainActor|State|Binding|ObservedObject|EnvironmentObject|StateObject|Published|AppStorage|Sendable)\b/.test(code)) {
    score += 3;
  }

  if (/(?:\b(?:actor|nonisolated|async\s+let|for\s+await)\b|Task\s*\{|Task\.sleep|MainActor\.run|withCheckedContinuation|withThrowingTaskGroup)/.test(code)) {
    score += 3;
  }

  if (/\bawait\b/.test(code)) {
    score += 1;
  }

  if (/\b(?:guard|if)\s+let\b|\bguard\s+case\b/.test(code) || /\bguard\s+![^\n{]+else\b/.test(code)) {
    score += 2;
  }

  if (/\b(?:defer|mutating|inout|associatedtype|CaseIterable|Codable|Hashable|AnyObject)\b/.test(code)) {
    score += 2;
  }

  if (/(?:^|\n)\s*(?:struct|class|enum|protocol)\s+\w+(?:\s*:\s*[^\{\n]+)?\s*\{/m.test(code)) {
    score += 1;
  }

  if (/(?:^|\n)\s*extension\s+\w+(?:\s*:\s*[^\{\n]+|\s+where\s+[^\{\n]+)?\s*\{/m.test(code)) {
    score += 2;
  }

  if (/\bfunc\s+\w+(?:<[^>]+>)?\s*\([^)]*\)\s*(?:async\s+)?(?:throws\s+)?(?:->\s*[^\{\n]+)?/.test(code)) {
    score += 2;
  }

  if (/\b(?:let|var)\s+\w+\s*:\s*\([^)]*\)\s*->\s*[\w\[\]<>?.!]+\s*=/.test(code)) {
    score += 2;
  }

  if (/\b(?:let|var)\s+\w+\s*:\s*\[[^\]]+\]\s*=/.test(code) ||
      /\b(?:let|var)\s+\w+\s*:\s*Result<[^>]+>\s*=/.test(code) ||
      /\b(?:let|var)\s+\w+\s*:\s*[A-Z]\w*(?:<[^>]+>)?(?:\?|!)?\s*=/.test(code) ||
      /\b(?:let|var)\s+\w+\s*:\s*[A-Z]\w*(?:<[^>]+>)?(?:\?|!)?(?:\s*$|\s*\n)/m.test(code)) {
    score += 2;
  }

  if (/\b(?:let|var)\s+\w+\s*=\s*(?:Set|Dictionary)<[^>]+>\(\)/.test(code) ||
      /\b(?:let|var)\s+\w+\s*=\s*URL\(string:/.test(code) ||
      /\blet\s*\([^)]*,[^)]*\)\s*=/.test(code)) {
    score += 2;
  }

  if (/\b(?:let|var)\s+\w+\s*=.+\?\?.+/.test(code) || /\?\./.test(code)) {
    score += 2;
  }

  if (/\\\([^)]*\)/.test(code)) {
    score += 2;
  }

  if (/\b(?:weak|lazy)\s+var\s+\w+\s*:\s*[A-Z]\w*(?:<[^>]+>)?\??/.test(code) ||
      /\bprivate\(set\)\s+var\b/.test(code)) {
    score += 2;
  }

  if (/\bdo\s*\{/.test(code) && /\bcatch\b/.test(code)) {
    score += 2;
  }

  if ((/\.(map|compactMap|reduce|sorted|filter)\b/.test(code) && /\$0|\$1/.test(code)) || /\.compactMap\([^)]*\.init\(\w+:/.test(code) || /removeAll\s*\{/.test(code)) {
    score += 2;
  }

  if (/\bif\s+case\s+let\s+\.\w+/.test(code)) {
    score += 2;
  }

  if (/\bswitch\s+\w+\s*\{/.test(code) && /\bcase\s+\.\w+/.test(code)) {
    score += 2;
  }

  if (/\bcase\s+\d+\.\.\.\d+/.test(code) || /\bfor\s+\w+\s+in\s+0\.\.</.test(code) || /stride\(from:/.test(code)) {
    score += 2;
  }

  if (/DispatchQueue\.main\.async|JSONDecoder\(\)\.decode|URLSession\.shared\.dataTask|URLSession\.shared\.data\(|UIView\.animate\(withDuration:|UIImage\(named:|NumberFormatter\(\)|DateFormatter\(\)|URLComponents\(|NotificationCenter\.default/.test(code)) {
    score += 2;
  }

  if (/if\s+#available\(/.test(code)) {
    score += 2;
  }

  if ((/\bcase\s+\.\w+/.test(code) || /\bcase\s+let\s+\.\w+/.test(code)) && /\b(enum|switch)\b/.test(code)) {
    score += 1;
  }

  if (/ToolbarItem\(|NavigationStack\b|List\s*\{|ForEach\s*\(|Button\(|Image\(systemName:/.test(code)) {
    score += 2;
  }

  if (/\{\s*\$0|\$0\.|\$1\./.test(code)) {
    score += 1;
  }

  if (/\b[A-Z]\w+\.init\(\w+:/.test(code)) {
    score += 1;
  }

  if (/\b(?:print|fatalError)\s*\(/.test(code) && /\\\([^)]*\)/.test(code)) {
    score += 1;
  }

  if (lines.length <= 3) {
    if (/\b(let|var)\s+\w+\s*=\s*\w+\?\.\w+(?:\?\.\w+)*/.test(code.trim())) {
      return 'swift';
    }

    if (/^print\s*\(/.test(code.trim()) && /\\\([^)]*\)/.test(code)) {
      return 'swift';
    }
  }

  if (score >= 2) {
    return 'swift';
  }

  return null;
};
