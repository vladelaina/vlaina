import type { LanguageDetector } from '../types';

export const detectCPP: LanguageDetector = (ctx) => {
  const { first100Lines, sample, hasDoubleColon, hasClass } = ctx;
  
  // Exclude JavaScript/TypeScript files - must check before any C++ detection
  if (/\b(console\.(log|error|warn)|alert\(|document\.|window\.|require\(|module\.exports|exports\.|import\s+.*from|export\s+(default|const|function)|Object\.defineProperty|var\s+\w+\s*=\s*function)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude JavaScript files with many var declarations (e.g., generated parsers)
  const varCount = (first100Lines.match(/\bvar\s+\w+\s*=/g) || []).length;
  if (varCount >= 5) {
    return null;
  }
  
  // Exclude JavaScript files with function declarations
  if (/\bfunction\s+\w+\s*\(/.test(first100Lines)) {
    // If it has function declarations but no strong C/C++ indicators, it's likely JavaScript
    // NULL alone is not enough (could be in comments), need #include or actual C functions
    if (!/#include\s*[<"]/.test(first100Lines) && 
        !/\b(printf|scanf|malloc|free|sizeof|std::|cout|cin)\b/.test(first100Lines)) {
      return null;
    }
  }
  
  // Exclude Dart files - check for Dart imports
  if (/\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+|part\s+['"])\b/.test(first100Lines)) {
    return null;
  }
  
  if (/#include\s*[<"]/.test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof|NULL)\b/.test(first100Lines)) {
    // Check for C++ specific features (but not <string.h> which is C)
    if (/\b(std::|cout|cin|vector|template|class|namespace|new\s+\w+|delete\s+\w+|using\s+namespace)\b/.test(first100Lines) ||
        (/\bstring\b/.test(first100Lines) && !/<string\.h>/.test(first100Lines))) {
      return 'cpp';
    }
    if (/\b(printf|scanf|struct\s+\w+|typedef)\b/.test(first100Lines) && !hasDoubleColon && !sample.includes('class')) {
      return 'c';
    }
    if (/#include\s*<\w+\.h>/.test(first100Lines) && !sample.includes('std::') && !sample.includes('class')) {
      return 'c';
    }
    // Check for typedef struct/enum (common in C headers)
    if (/\btypedef\s+(struct|enum)\b/.test(first100Lines) && !hasDoubleColon && !sample.includes('class') && !sample.includes('template')) {
      return 'c';
    }
    // If has #include but no C++ features, likely C (especially for .h headers)
    if (!hasDoubleColon && !sample.includes('class') && !sample.includes('template') && !sample.includes('namespace')) {
      return 'c';
    }
    return 'cpp';
  }
  
  if (/\b(struct|typedef|enum)\s+\w+/.test(first100Lines) && /\b(int|char|float|double|void)\s+\w+/.test(first100Lines)) {
    if (sample.includes('::') || sample.includes('class') || sample.includes('template')) {
      return 'cpp';
    }
    return 'c';
  }
  
  // Only detect C++ class if it's not JavaScript
  if (/\b(protected|private|public)\s*:/.test(first100Lines) && hasClass) {
    // Make sure it's not JavaScript class with alert/super
    if (!sample.includes('alert(') && !sample.includes('super.')) {
      return 'cpp';
    }
  }
  
  return null;
};
