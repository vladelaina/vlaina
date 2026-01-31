import type { LanguageDetector } from '../types';

export const detectScala: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, firstLine, lines } = ctx;
  
  // Exclude JavaScript/TypeScript files
  if (/\b(var\s+\w+\s*=|function\s+\w+|console\.|document\.|window\.|require\(|module\.exports|alert\(|constructor\s*\()\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Go files (Go has package but different syntax)
  if (/^package\s+\w+$/m.test(first100Lines) && /\b(func\s+\w+|import\s+\()\b/.test(first100Lines)) {
    return null;
  }
  
  // Scala shebang scripts - already handled by checkShebang in common.ts
  // But keep this as fallback
  if (firstLine.includes('exec scala')) {
    return 'scala';
  }
  
  // Strong Scala indicators - import scala.* or scala.language.*
  if (/\b(import\s+scala\.|import\s+math\.|package\s+object)\b/.test(first100Lines)) {
    return 'scala';
  }
  
  // Scala build files (.sbt) - check for := operator with common sbt keywords
  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return 'scala';
  }
  
  // Scala-specific patterns - need strong evidence
  if (hasCurlyBraces) {
    // Scala object/trait/case class
    if (/\b(object\s+\w+\s+(extends|with)|trait\s+\w+|case\s+class)\b/.test(first100Lines)) {
      return 'scala';
    }
    
    // Scala def with type annotation
    if (/\bdef\s+\w+\s*(\(.*\))?\s*:\s*\w+/.test(first100Lines)) {
      return 'scala';
    }
    
    // Scala val/var with type annotation
    if (/\b(val|var)\s+\w+\s*:\s*\w+/.test(first100Lines)) {
      if (sample.includes('<-') ||
          /\b(extends|with|implicit|sealed|match\s*\{)\b/.test(first100Lines)) {
        return 'scala';
      }
    }
    
    // Scala without type annotations but with Scala-specific patterns
    // Check for val/var/def + Scala collections or other Scala features
    if (/\b(val|var|def)\s+\w+/.test(first100Lines)) {
      if (/\b(collection\.(mutable|immutable)|Vector2D|PicShape|Picture\{)\b/.test(first100Lines) ||
          /\b(repeat|forward|right|draw|trans)\s*\(/.test(first100Lines)) {
        return 'scala';
      }
    }
  }
  
  // Scala worksheet files (.sc) - import scala.* without package
  if (/^import\s+(scala|math)\./m.test(first100Lines)) {
    if (/\b(object\s+\w+|def\s+\w+|val\s+\w+|println\()\b/.test(first100Lines)) {
      return 'scala';
    }
  }
  
  return null;
};
