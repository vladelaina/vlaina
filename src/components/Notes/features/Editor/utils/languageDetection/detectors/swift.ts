import type { LanguageDetector } from '../types';

export const detectSwift: LanguageDetector = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces } = ctx;
  
  // Strong Swift indicators
  if (/\b(import\s+Foundation|import\s+UIKit|import\s+SwiftUI)\b/.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift-specific patterns - more relaxed
  if (/\b(func\s+\w+|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+|class\s+\w+:\s*\w+|struct\s+\w+|enum\s+\w+|protocol\s+\w+)\b/.test(first100Lines)) {
    if (sample.includes('->') ||
        /\b(guard|defer|mutating|inout|@\w+|extension\s+\w+)\b/.test(first100Lines) ||
        /\?\?|\?\./.test(first100Lines)) {
      return 'swift';
    }
  }
  
  // Swift string interpolation: \(variable) - doesn't need curly braces
  if (/\\\([\w\s+]+\)/.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift optional binding: if let / var
  if (/\b(if|guard)\s+let\s+\w+/.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift array/dictionary literals with type annotations
  // let/var name = Type[]() or Dictionary<Type, Type>()
  if (/\b(let|var)\s+\w+\s*=\s*\w+\[\]\(\)/.test(first100Lines)) {
    return 'swift';
  }
  
  if (/\b(let|var)\s+\w+\s*=\s*Dictionary</.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift array/dictionary literals - simple assignment
  // var name = ["item1", "item2"] or ["key": "value"]
  if (/\b(var|let)\s+\w+\s*=\s*\[/.test(first100Lines)) {
    // Check if it's a dictionary (has "key": "value" pattern)
    if (/\[[\s\n]*"[^"]+"\s*:\s*"[^"]+"\s*[,\]]/.test(first100Lines)) {
      return 'swift';
    }
    // Check if it's an array with multiple elements
    if (/\[[\s\n]*"[^"]+"\s*,/.test(first100Lines)) {
      return 'swift';
    }
  }
  
  // Swift simple array assignment without var/let (e.g., "shoppingList = []")
  // This is a very weak signal, but if the file is very short and has this pattern, it's likely Swift
  if (ctx.lines.length <= 3 && /^\w+\s*=\s*\[\s*\]/.test(first100Lines.trim())) {
    return 'swift';
  }
  
  // Swift without strong type annotations - check for Swift-specific syntax
  if (hasCurlyBraces) {
    // Swift for-in loop
    if (/\bfor\s+\w+\s+in\s+/.test(first100Lines)) {
      if (/\b(let|var)\s+\w+\s*=/.test(first100Lines)) {
        return 'swift';
      }
    }
    
    // Swift switch with case
    if (/\bswitch\s+\w+\s*\{/.test(first100Lines) && /\bcase\s+/.test(first100Lines)) {
      return 'swift';
    }
    
    // Swift do-while
    if (/\bdo\s*\{/.test(first100Lines) && /\}\s*while\s+/.test(first100Lines)) {
      return 'swift';
    }
  }
  
  return null;
};
