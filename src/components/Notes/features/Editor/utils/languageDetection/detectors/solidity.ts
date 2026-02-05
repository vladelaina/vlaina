import type { LanguageDetector } from '../types';

export const detectSolidity: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines, lines } = ctx;

  // Simple single-line Solidity patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Solidity state variable: uint256 public totalSupply;
    if (/^uint(8|16|32|64|128|256)?\s+(public|private|internal)?\s*\w+\s*;?$/.test(trimmed)) {
      return 'solidity';
    }
  }

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

  if (/\bmapping\s*\(\s*address\s*=>/.test(code)) {
    return 'solidity';
  }

  if (/\bfunction\s+\w+\s*\([^)]*\)\s+(public|private|external|internal)\s+(view|pure|payable|returns)/.test(code)) {
    return 'solidity';
  }

  if (/\bfunction\s+\w+\s*\(\s*address\s+\w+/.test(code) && /\buint256\b/.test(code)) {
    return 'solidity';
  }

  if (/\bmodifier\s+\w+\s*\(\s*\)\s*\{/.test(code)) {
    return 'solidity';
  }

  if (/\bevent\s+\w+\s*\(\s*address\s+indexed/.test(code)) {
    return 'solidity';
  }

  if (/\bfunction\s+\w+\s*\([^)]*\)\s+(public|private|external|internal)\b/.test(code)) {
    if (/\b(address|uint256|uint|bool|returns)\b/.test(code)) {
      return 'solidity';
    }
  }

  if (/\bfunction\s+\w+\s*\([^)]*address[^)]*\)\s+(public|private|external|internal)/.test(code)) {
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
