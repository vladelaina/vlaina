import type { LanguageDetector } from '../types';

export const detectSolidity: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (/^namespace\s+[\w.]+$/m.test(first100Lines) || /^open\s+[A-Z][\w.]*$/m.test(first100Lines) || /\blet\s+\w+\s*=/.test(first100Lines)) {
    return null;
  }

  if (/\b(module\s+\w+\s+where|import\s+qualified|data\s+\w+\s*=)\b/.test(first100Lines)) {
    return null;
  }

  if (/@(interface|implementation|property|synthesize|end)\b/.test(first100Lines)) {
    return null;
  }

  if (/^pragma\s+solidity/.test(firstLine)) {
    return 'solidity';
  }

  if (/\b(contract|interface|library)\s+\w+/.test(code)) {

    if (/\b(function|modifier|event|mapping|payable|view|pure|external|internal|public|private)\b/.test(code)) {

      if (/\b(pragma\s+solidity|mapping\s*\(|payable|msg\.sender|msg\.value)\b/.test(code)) {
        return 'solidity';
      }
    }
  }

  return null;
};
