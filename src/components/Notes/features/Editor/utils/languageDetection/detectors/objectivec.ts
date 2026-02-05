import type { LanguageDetector } from '../types';

export const detectObjectiveC: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  // Objective-C #import with Foundation/UIKit
  if (/#import\s+[<"]/.test(first100Lines)) {
    // Foundation/UIKit imports (very distinctive) - immediate match
    if (/#import\s+<(Foundation|UIKit|CoreFoundation|CFNetwork|MobileCoreServices|SystemConfiguration)\//.test(first100Lines)) {
      return 'objectivec';
    }

    // Objective-C NS* types
    if (/\bNS[A-Z]\w+\s*\*/.test(first100Lines)) {
      return 'objectivec';
    }

    // Objective-C @interface, @implementation, @protocol
    if (/@interface\s+\w+|@implementation\s+\w+|@protocol\s+\w+/.test(code)) {
      return 'objectivec';
    }

    // Objective-C method declaration
    if (/[-+]\s*\([^)]+\)\s*\w+/.test(code)) {
      return 'objectivec';
    }

    // Objective-C @property
    if (/@property\s*\([^)]*\)/.test(code)) {
      return 'objectivec';
    }

    // Objective-C header import
    if (/#import\s+"[\w/]+\.h"/.test(first100Lines) &&
        !/\b(using\s+namespace|std::|template|class\s+\w+\s*:\s*public)\b/.test(first100Lines)) {
      return 'objectivec';
    }
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|interface\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (!/[{}]/.test(code) && /^%\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(namespace\s+\w+|class\s+\w+|using\s+namespace)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bNSArray\s*\*\w+\s*=\s*\[/.test(code)) {
    return 'objectivec';
  }

  if (/\[\w+\s+filteredArrayUsingPredicate:/.test(code)) {
    return 'objectivec';
  }

  if (/@interface\s+\w+|@implementation\s+\w+/.test(code)) {
    return 'objectivec';
  }

  if (/@protocol\s+\w+/.test(code)) {
    return 'objectivec';
  }

  if (/[-+]\s*\([^)]+\)\s*\w+/.test(code)) {

    if (/@interface|@implementation|@protocol/.test(code)) {
      return 'objectivec';
    }
  }

  if (/@property\s*\([^)]*\)/.test(code)) {
    return 'objectivec';
  }

  if (/\[\w+\s+\w+/.test(code)) {

    if (/@interface|@implementation|@protocol|#import/.test(code)) {
      return 'objectivec';
    }
  }

  return null;
};
