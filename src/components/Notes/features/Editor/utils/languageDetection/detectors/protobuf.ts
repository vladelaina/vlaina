import type { LanguageDetector } from '../types';

export const detectProtobuf: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (/^#{1,6}\s+\w+/m.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+|part\s+['"])\b/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+\w+$/m.test(first100Lines) && /\bfunc\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(fn\s+main|pub\s+fn|impl\s+\w+|use\s+std::)\b/.test(first100Lines)) {
    return null;
  }

  if (/^-module\(|^-export\(|^-include\(/.test(first100Lines)) {
    return null;
  }

  if (/\b(defmodule|defp|def\s+\w+\s+do|use\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(module\s+\w+\s+where|import\s+qualified|data\s+\w+\s*=)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=|module\s+\w+\s*=|open\s+\w+|type\s+\w+\s*=)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|DROP\s+TABLE)\b/i.test(first100Lines)) {
    return null;
  }

  if (/@interface\s+\w+|@implementation\s+\w+|@property\s*\(/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+\w+;$/m.test(first100Lines) &&
      /\boption\s+\w+\s*=/.test(code) &&
      /\benum\s+\w+\s*\{[\s\S]*?=\s*\d+/.test(code)) {
    return 'protobuf';
  }

  if (/^syntax\s*=\s*"proto[23]"/.test(firstLine)) {
    return 'protobuf';
  }

  if (/message\s+\w+\s*\{/.test(code)) {

    if (/\b(string|int32|int64|bool|bytes|double|float|repeated|optional|required)\s+\w+\s*=\s*\d+/.test(code)) {
      return 'protobuf';
    }
  }

  if (/service\s+\w+\s*\{/.test(code) && /\brpc\s+\w+\s*\(/.test(code)) {
    return 'protobuf';
  }

  if (/\b(package|import|option|enum|oneof|repeated|optional|required)\b/.test(code)) {
    if (/\bmessage\s+\w+\s*\{/.test(code) || /\bservice\s+\w+\s*\{/.test(code)) {
      return 'protobuf';
    }
  }

  return null;
};
