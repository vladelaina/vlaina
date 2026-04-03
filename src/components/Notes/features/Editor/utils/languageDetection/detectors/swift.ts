import type { LanguageDetector } from '../types';

export const detectSwift: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, code, lines } = ctx;

  // Simple single-line Swift patterns
  if (lines.length <= 3) {
    // Swift optional chaining: let length = user?.name?.count
    if (/\b(let|var)\s+\w+\s*=\s*\w+\?\.\w+(\?\.\w+)*/.test(code.trim())) {
      return 'swift';
    }
    
    if (/^print\s*\(/.test(code.trim())) {
      // Check for Swift-specific patterns
      if (/\bprint\s*\(\s*"[^"]*"\s*\)\s*$/.test(code.trim())) {
        // Just print("string") - ambiguous, default to Python (more common)
        return null;
      }
      if (/\blet\b|\bvar\b|\bfunc\b|\bstruct\b/.test(code)) {
        return 'swift';
      }
    }
    // Swift type annotation with colon
    if (/\b(var|let)\s+\w+\s*:\s*[A-Z]\w*\s*=/.test(code)) {
      return 'swift';
    }
  }

  // Swift struct definition
  if (/^struct\s+\w+\s*\{/m.test(code)) {
    if (/\b(var|let)\s+\w+:\s*\w+/.test(code)) {
      return 'swift';
    }
  }

  if (/^extends\s+\w+/m.test(first100Lines)) {
    return null;
  }

  // Exclude C/C++ files (has /* */ comments, #include, or typedef)
  if (/^\/\*[\s\S]*?\*\//m.test(first100Lines) ||
      /#include\s*[<"]/.test(first100Lines) ||
      /\btypedef\s+(struct|enum|union)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(let|var)\s+\w+\s*=\s*\w+\.(filter|map|flatMap|compactMap|reduce)\s*\{\s*\$0/.test(code)) {
    return 'swift';
  }

  if (/\b(let|var)\s+\w+\s*=\s*\w+\.sorted\s*\{/.test(code) && /\$0\.\w+/.test(code)) {
    return 'swift';
  }

  if (/\.(prefix|suffix)\s*\(\d+\)/.test(code) && /\blet\s+/.test(code)) {
    return 'swift';
  }

  if (/\b(guard|defer)\s+/.test(first100Lines)) {
    return 'swift';
  }

  if (/@(Published|State|Binding|ObservedObject|EnvironmentObject|AppStorage)\b/.test(first100Lines)) {
    return 'swift';
  }

  // SwiftUI View protocol (very strong indicator)
  if (/struct\s+\w+:\s*View\s*\{/.test(code) ||
      /\bvar\s+body:\s*some\s+View\s*\{/.test(code)) {
    return 'swift';
  }

  // SwiftUI components (strong indicator)
  if (/\b(NavigationView|List|ForEach|Button|Text|VStack|HStack|ZStack)\s*\{/.test(code)) {
    if (/@State|@Binding|\.sheet\(|\.toolbar\(/.test(code)) {
      return 'swift';
    }
  }

  // SwiftUI with @State and struct
  if (/@State\s+(private\s+)?var\s+\w+/.test(code) && /struct\s+\w+/.test(code)) {
    return 'swift';
  }

  // SwiftUI navigation and sheets (very strong indicator)
  if (/\.sheet\s*\(\s*isPresented:\s*\$/.test(code) ||
      /\.toolbar\s*\{/.test(code) ||
      /\.navigationTitle\(/.test(code)) {
    return 'swift';
  }

  // SwiftUI binding syntax (very strong indicator)
  if (/\$\w+/.test(code) && /@State/.test(code)) {
    return 'swift';
  }

  // SwiftUI List with ForEach
  if (/\bList\s*\{/.test(code) && /\bForEach\s*\(/.test(code)) {
    return 'swift';
  }

  // SwiftUI onDelete
  if (/\.onDelete\s*\(\s*perform:\s*\w+\)/.test(code)) {
    return 'swift';
  }

  // SwiftUI Image with systemName
  if (/\bImage\s*\(\s*systemName:\s*"/.test(code)) {
    return 'swift';
  }

  // SwiftUI items.remove(atOffsets:)
  if (/\.remove\s*\(\s*atOffsets:\s*/.test(code)) {
    return 'swift';
  }

  if (/\bguard\s+let\s+\w+\s*=/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(import\s+Foundation|import\s+UIKit|import\s+SwiftUI)\b/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(func\s+\w+|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+|class\s+\w+:[ \t]*\w+|struct\s+\w+|enum\s+\w+|protocol\s+\w+)\b/.test(first100Lines)) {
    if (sample.includes('->') ||
        /\b(guard|defer|mutating|inout|@\w+|extension\s+\w+)\b/.test(first100Lines) ||
        /\?\?|\?\./.test(first100Lines)) {
      return 'swift';
    }
  }

  if (/\\\([\w\s+]+\)/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(if|guard)\s+let\s+\w+/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(let|var)\s+\w+\s*=\s*\w+\[\]\(\)/.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(let|var)\s+\w+\s*=\s*Dictionary</.test(first100Lines)) {
    return 'swift';
  }

  if (/\b(var|let)\s+\w+\s*=\s*\[/.test(first100Lines)) {

    if (/\[[\s\n]*"[^"]+"\s*:\s*"[^"]+"\s*[,\]]/.test(first100Lines)) {
      return 'swift';
    }

    if (/\[[\s\n]*"[^"]+"\s*,/.test(first100Lines)) {
      return 'swift';
    }
  }

  if (ctx.lines.length <= 3 && /^\w+\s*=\s*\[\s*\]/.test(first100Lines.trim())) {
    return 'swift';
  }

  if (hasCurlyBraces) {

    if (/\bfor\s+\w+\s+in\s+/.test(first100Lines)) {
      if (/\b(let|var)\s+\w+\s*=/.test(first100Lines)) {
        return 'swift';
      }
    }

    if (/\bswitch\s+\w+\s*\{/.test(first100Lines) && /\bcase\s+/.test(first100Lines)) {
      return 'swift';
    }

    if (/\bdo\s*\{/.test(first100Lines) && /\}\s*while\s+/.test(first100Lines)) {
      return 'swift';
    }
  }

  return null;
};
