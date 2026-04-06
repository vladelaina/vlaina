import type { LanguageDetector } from '../types';

export const detectRust: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (
    /^package\s+[\w:]+;/m.test(first100Lines) ||
    /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
    /^#include\s+</m.test(first100Lines) ||
    /@import\(["']/.test(first100Lines) ||
    /(?:^|\n)\s*(?:export\s+)?type\s+\w+(?:<[^>\n]+>)?\s*=\s*\{[\s\S]*?\};/.test(code) ||
    /(?:^|\n)\s*(?:export\s+)?type\s+\w+(?:<[^>\n]+>)?\s*=\s*(?:\n\s*)?\|?\s*\{[\s\S]*?\};/.test(code) ||
    /(?:^|\n)\s*(?:export\s+)?type\s+\w+(?:<[^>\n]+>)?\s*=\s*[^;\n]*\b(?:readonly|keyof|infer|typeof|null|undefined|Record<|Partial<|Required<|Pick<|Omit<|Extract<|Exclude<|ReturnType<|Parameters<|InstanceType<|Awaited<|Promise<|JSX\.Element)\b[^;]*;/.test(code) ||
    /\bnamespace\s+\w+\s*\{/.test(code) ||
    /\bdeclare\s+(?:global|module|const|function|interface)\b/.test(code) ||
    /\benum\s+\w+\s*\{[\s\S]*?=\s*['"]/.test(code) ||
    /\b(let|var)\s+\w+:\s*Result<[^>]+>\s*=\s*\.(success|failure)\(/.test(code) ||
    /\bSet<[^>]+>\(\)|\bDictionary<[^>]+>\(\)/.test(code) ||
    (/\bpub\s+fn\s+\w+\s*\([^)]*\)\s+[!A-Za-z_][\w:.<>]*\s*\{/.test(code) && !/->/.test(code)) ||
    /\benum\s+\w+\s*\{[\s\S]*\bcase\s+[a-z]\w*/.test(code) ||
    (/\benum\s+\w+\s*\{[\s\S]*\};/.test(code) && /\b[A-Z][A-Z0-9_]+\b/.test(code) && !/::/.test(code)) ||
    /\bclass\s+\w+/.test(code) ||
    /\btemplate\s*</.test(code) ||
    /\bnamespace\s+\w+(?:::\w+)*\s*\{/.test(code) ||
    /\boperator\s*[<>=+\-*\/!]+\s*\(/.test(code) ||
    /\bnoexcept\b/.test(code) ||
    /\bexplicit\s+\w+\s*\(/.test(code) ||
    /\bconst\s+\w+(?:::\w+)*(?:<[^>]+>)?\s*&\s*\w+/.test(code) ||
    /\bstd::(?:move|swap|to_string|vector|string|promise|get_future|packaged_task|filesystem|optional|variant|array|byte|scoped_lock|shared_lock|transform_reduce|gcd|lcm|clamp|ostream_iterator|istream_iterator)\b/.test(code) ||
    (/@[\w-]+\s*:/.test(first100Lines) && /\{[\s\S]*?\}/.test(first100Lines))
  ) {
    return null;
  }

  const hasStdPath = /\b(?:use\s+(?:std|self|super|crate|tokio|serde_json|reqwest)::|std::|self::|super::|crate::|tokio::|serde_json::|reqwest::)/.test(code);
  const hasMacro = /\b(?:println|eprintln|format|matches|panic|todo|unreachable|dbg|assert_eq|vec|include_str|include_bytes|macro_rules|write)!\s*\(/.test(code) || /\bmacro_rules!\s+\w+/.test(code);
  const hasLifetime = /<'[a-z]\w*>/.test(code) || /&'[a-z]\w*\s+\w+/.test(code) || /fmt::Formatter<'_>/.test(code);
  const hasRustType = /(?:&(?:'[_a-z]\w*\s+)?(?:str|mut\s+\w+|\[[^\]]+\])|\b(?:String|Vec|Option|Result|Box|HashMap|HashSet|BTreeMap|VecDeque|BinaryHeap|Rc|Arc|Mutex|RefCell|Cow|PathBuf|Path|Future|Pin|Self|char|bool|usize|isize|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128)\b)/.test(code);
  const hasFn = /\b(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+\w+(?:<[^>]+>)?\s*\(/.test(code);
  const hasReturnType = /\bfn\s+\w+(?:<[^>]+>)?\s*\([^)]*\)\s*->/.test(code);
  const hasStructFields = /\b(?:pub\s+)?struct\s+\w+(?:<[^>]+>)?\s*\{[\s\S]*?:\s*[^,}]+,/m.test(code);
  const hasTupleStruct = /\bstruct\s+\w+(?:<[^>]+>)?\s*\([^)]*\)\s*;/m.test(code);
  const hasUnitStruct = /\bstruct\s+\w+\s*;/m.test(code);
  const hasEnum = /\benum\s+\w+(?:<[^>]+>)?\s*\{/.test(code);
  const hasEnumVariant = /\benum\s+\w+(?:<[^>]+>)?\s*\{[\s\S]*?(?:[A-Z]\w+\([^)]*\)|[A-Z]\w+\s*\{[^}]+\}|=\s*\d+)/.test(code);
  const hasTrait = /\btrait\s+\w+(?:<[^>]+>)?\s*\{/.test(code);
  const hasImpl = /\bimpl(?:<[^>]+>)?(?:\s+[A-Za-z_][\w:<>]*\s+for)?\s+[A-Za-z_][\w:<>]*\s*\{/.test(code);
  const hasTypeAlias = /\btype\s+\w+(?:<[^>]+>)?\s*=\s*[^;]+;/.test(code);
  const hasSimpleLetMut = /^\s*let\s+mut\s+\w+(?:\s*:\s*[^=]+)?\s*=/.test(code.trim());
  const hasConstItem = /^\s*const\s+[A-Z_][A-Z0-9_]*\s*:\s*[^=]+\s*=/.test(code.trim());
  const hasStaticMut = /^\s*static\s+mut\s+[A-Z_][A-Z0-9_]*\s*:\s*[^=]+\s*=/.test(code.trim());
  const hasModDecl = code.split(/\n/).filter(Boolean).length > 0 && code.split(/\n/).filter(Boolean).every((line) => /^mod\s+\w+;\s*$/.test(line));
  const hasVisibility = /\bpub(?:\([^)]*\))?\s+(?:fn|struct|enum|trait)\b/.test(code);
  const hasLetMut = /\blet\s+mut\s+\w+(?:\s*:\s*[^=;]+)?/.test(code);
  const hasIfLet = /\b(?:if|while)\s+let\s+/.test(code);
  const hasMatch = /\bmatch\s+[^\n{]+\{[\s\S]*?=>/.test(code);
  const hasQuestion = /\?(?=[;,)])/m.test(code);
  const hasWhereClause = /^\s*where\s+[A-Z]\w*\s*:/m.test(code);
  const hasArrowArm = /=>\s*(?:Some|None|Ok|Err|"|\d|\w+)/.test(code);
  const hasRustMethod = /\.(?:unwrap|unwrap_or|unwrap_or_else|expect|map_err|as_deref|to_string|to_lowercase|into_iter|collect|copied|retain|sort_by_key|push_str|push_front|borrow_mut|lock|join|recv|send)\s*\(/.test(code);
  const hasQuestionableBorrow = /&(?:str|mut\s+\w+|dyn\s+[A-Za-z_:][\w:<>]*)/.test(code);
  const hasConstGeneric = /const\s+[A-Z]\w*:\s*usize/.test(code);
  const hasRawRustLiteral = /\br#"|\bb"/.test(code);
  const hasRustPathType = /\b[A-Za-z_][\w]*::[A-Za-z_][\w]*(?:::[A-Za-z_][\w]*)*/.test(code);

  if (hasLifetime || hasMacro || hasStdPath || hasSimpleLetMut || hasConstItem || hasStaticMut || hasModDecl) {
    return 'rust';
  }

  if (hasStructFields || hasTupleStruct || hasUnitStruct || hasTrait || hasImpl) {
    return 'rust';
  }

  if (hasEnum && (hasEnumVariant || hasFn || hasTrait || hasImpl || hasVisibility || hasMatch || hasMacro || hasStdPath || /#\[/.test(code))) {
    return 'rust';
  }

  if (hasTypeAlias && (/\b(?:Result|Option|Box|dyn)\b/.test(code) || hasRustPathType)) {
    return 'rust';
  }

  if (hasVisibility && (hasFn || hasStructFields || hasEnum || hasTrait)) {
    return 'rust';
  }

  if (hasFn && (hasReturnType || hasRustType || hasQuestionableBorrow || hasWhereClause || hasConstGeneric)) {
    return 'rust';
  }

  if (hasFn && (hasIfLet || hasMatch || hasQuestion || hasRustMethod || hasArrowArm || hasLetMut || hasRawRustLiteral)) {
    return 'rust';
  }

  const rustScore =
    (hasFn ? 1 : 0) +
    (hasReturnType ? 1 : 0) +
    (hasRustType ? 1 : 0) +
    (hasQuestionableBorrow ? 1 : 0) +
    (hasLetMut ? 1 : 0) +
    (hasIfLet ? 1 : 0) +
    (hasMatch ? 1 : 0) +
    (hasQuestion ? 1 : 0) +
    (hasWhereClause ? 2 : 0) +
    (hasRustMethod ? 1 : 0) +
    (hasRustPathType ? 1 : 0) +
    (hasRawRustLiteral ? 1 : 0);

  if (rustScore >= 4) {
    return 'rust';
  }

  return null;
};
