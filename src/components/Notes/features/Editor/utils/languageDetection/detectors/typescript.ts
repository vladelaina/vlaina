import type { LanguageDetector } from '../types';

export const detectTypeScript: LanguageDetector = (ctx) => {
  const { code, first100Lines, hasImport, hasConst, hasLet, hasSemicolon, lines } = ctx;

  if (/\b(public|private|protected):\s*$/m.test(code) || /\b(enum\s+class|virtual|override|noexcept)\b/.test(code) || /\bstd::/.test(code) || /\b(class|struct)\s+\w+\s*:\s*(public|private|protected)\b/.test(code) || /\b(typedef\s+struct|typedef\s+void\s*\(\*|union\s+\w+\s*\{|restrict\b|volatile\b|extern\s+\w|static\s+inline)\b/.test(code) || /^struct\s+\w+\s*\{/m.test(code) || /\bconst\s+char\s*\*/.test(code) || /\b(?:int|char|float|double|short|long|unsigned|signed|void)\s+\**\w+\s*\([^)]*\)\s*\{/.test(code)) {
    return null;
  }

  if (/^#include\s*[<"]/.test(first100Lines) || /^#\s*(define|ifdef|ifndef|elif|else|endif)\b/m.test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof)\s*\(/.test(code)) {
    return null;
  }

  if (
    /^enum\s+\w+\s*\{/m.test(first100Lines) && /\b(int|char|float|double|void)\s+\w+\s*\([^)]*\)\s*\{/.test(code) ||
    /^enum\s+\w+\s*\{[\s\S]*?\};/m.test(code) && /\b(?:enum\s+\w+\s+)?\w+\s*=/.test(code) ||
    /^#import\s+[<"]/.test(first100Lines) ||
    /@(interface|implementation|property|protocol)\b/.test(code) ||
    /\b(?:fn\s+\w+\s*\(|let\s+mut\b|impl\b|pub\s+fn\b|use\s+(?:std|crate|self|super)::)\b/.test(code) ||
    /^package\s+\w+$/m.test(first100Lines) && /\bfunc\s+\w+\s*\(/.test(code)
  ) {
    return null;
  }

  const hasTypeAlias = /(?:^|\n)\s*(?:export\s+)?type\s+[A-Za-z_$]\w*(?:<[^>\n]+>)?\s*=/.test(code);
  const hasInterface = /(?:^|\n)\s*(?:export\s+)?interface\s+[A-Za-z_$]\w*(?:<[^>\n]+>)?(?:\s+extends\s+[^{\n]+)?\s*\{/.test(code);
  const hasEnum = /(?:^|\n)\s*(?:export\s+)?(?:const\s+)?enum\s+[A-Za-z_$]\w*\s*\{/.test(code);
  const hasNamespace = /(?:^|\n)\s*(?:export\s+)?namespace\s+[A-Za-z_$]\w*\s*\{/.test(code);
  const hasDeclare = /(?:^|\n)\s*declare\s+(?:global|module|namespace|const|function|class|interface|type|enum)\b/.test(code);
  const hasImportType = /\bimport\s+type\s+\{/.test(code);
  const hasImportEquals = /\bimport\s+[A-Za-z_$]\w*\s*=\s*require\(/.test(code);
  const hasExportType = /\bexport\s+(?:type|interface)\b/.test(code);
  const hasUtilityType = /\b(?:Record|Partial|Required|Pick|Omit|Extract|Exclude|ReturnType|Parameters|InstanceType|Awaited)\s*</.test(code);
  const hasTypeKeyword = /\b(?:readonly|keyof|infer|satisfies|asserts)\b/.test(code);
  const hasValuePredicate = /\bvalue\s+is\s+[A-Za-z_$][\w.<>]*/.test(code);
  const hasTypeofAlias = /\btypeof\s+[A-Za-z_$]\w*/.test(code);
  const hasTemplateLiteralType = /type\s+[A-Za-z_$]\w*(?:<[^>\n]+>)?\s*=\s*`[^`]+`/.test(code);
  const hasIndexedAccessType = /type\s+[A-Za-z_$]\w*(?:<[^>\n]+>)?\s*=\s*[A-Za-z_$][\w.]*\[['"][^'"]+['"]\]/.test(code);
  const hasTupleAnnotation = /:\s*(?:readonly\s+)?\[[^[\]\n]+(?:,[^[\]\n]+)+\]\s*=/.test(code);
  const hasTypedCollection = /:\s*(?:Array<[^>\n]+>|Promise<[^>\n]+>|Map<[^>\n]+>|Set<[^>\n]+>|Record<[^>\n]+>|JSX\.Element|bigint\b)/.test(code);
  const hasTypedBinding = /\b(?:const|let|var)\s+[A-Za-z_$]\w*\s*:\s*[^=\n]+\s*=/.test(code);
  const hasFunctionGenerics = /\b(?:async\s+)?function\s+\w+<[^>\n]+>\s*\(/.test(code);
  const hasFunctionParameterTypes = /\b(?:async\s+)?function\s+\w+(?:<[^>\n]+>)?\s*\([^)]*:\s*[^)]+\)/.test(code);
  const hasFunctionReturnType = /\b(?:async\s+)?function\s+\w+(?:<[^>\n]+>)?\s*\([^)]*\)\s*:\s*(?:asserts\s+[A-Za-z_$]\w+\s+is\s+[A-Za-z_$][\w.<>]*|[A-Za-z_$][\w.[\]<>|'`?:, ]+)/.test(code);
  const hasArrowReturnType = /\b(?:const|let|var)\s+[A-Za-z_$]\w*\s*=\s*(?:async\s*)?(?:<[^>\n]+>\s*)?\([^)]*\)\s*:\s*[^=]+=>/.test(code);
  const hasTypedArrowParameters = /\b(?:const|let|var)\s+[A-Za-z_$]\w*\s*=\s*(?:async\s*)?(?:<[^>\n]+>\s*)?\([^)]*:\s*[^)]+\)\s*(?::\s*[^=]+)?=>/.test(code);
  const hasGenericCall = /\b(?:const|let|var)\s+[A-Za-z_$]\w*\s*=\s*[A-Za-z_$][\w.]*<[^>\n]+>\s*\(/.test(code);
  const hasClass = /\b(?:abstract\s+)?class\s+[A-Za-z_$]\w*(?:<[^>\n]+>)?/.test(code);
  const hasParameterProperty = /\bconstructor\s*\(\s*(?:(?:public|private|protected)\s+)?(?:readonly\s+)?[A-Za-z_$]\w*\s*:\s*[^)]+\)/.test(code);
  const hasClassFieldType = /\b(?:public|private|protected)?\s*(?:readonly\s+)?[A-Za-z_$]\w*\??:\s*[^;=\n]+(?:\s*=|;)/.test(code);
  const hasGetterType = /\bget\s+[A-Za-z_$]\w*\s*\(\)\s*:\s*[^({\n]+/.test(code);
  const hasSetterType = /\bset\s+[A-Za-z_$]\w*\s*\([^)]*:\s*[^)]+\)/.test(code);
  const hasMethodType = /\b(?:public|private|protected)\s+[A-Za-z_$]\w*\s*\([^)]*:\s*[^)]+\)\s*:\s*[^({;\n]+/.test(code);
  const hasFunctionOverload = /(?:^|\n)\s*function\s+\w+\s*\([^)]*:\s*[^)]+\)\s*:\s*[^;{]+\s*;/.test(code);
  const hasConstructorOverload = /\bconstructor\s*\([^)]*:\s*[^)]+\)\s*;/.test(code);
  const hasThisParameter = /\bfunction\s+\w+\s*\(\s*this\s*:\s*[^,]+,/.test(code);
  const hasTypeAssertion = /\bas\s+(?:const|unknown|never|any|readonly|[A-Za-z_$][\w.<>]*)\b/.test(code);
  const hasNonNullAssertion = /\b[A-Za-z_$][\w.]*!\./.test(code);

  if (
    hasTypeAlias ||
    hasInterface ||
    hasEnum ||
    hasNamespace ||
    hasDeclare ||
    hasImportType ||
    hasImportEquals ||
    hasExportType
  ) {
    return 'typescript';
  }

  if (
    hasUtilityType ||
    hasTypeKeyword ||
    hasValuePredicate ||
    hasTypeofAlias ||
    hasTemplateLiteralType ||
    hasIndexedAccessType ||
    hasTupleAnnotation ||
    hasTypeAssertion ||
    hasNonNullAssertion ||
    hasThisParameter
  ) {
    return 'typescript';
  }

  if (
    hasClass &&
    (hasParameterProperty || hasClassFieldType || hasGetterType || hasSetterType || hasMethodType || hasConstructorOverload)
  ) {
    return 'typescript';
  }

  if (
    hasFunctionOverload ||
    hasFunctionGenerics ||
    (hasFunctionParameterTypes && (hasFunctionReturnType || /:\s*(?:unknown|never|void|Promise<|Array<|Map<|Set<)/.test(code))) ||
    hasArrowReturnType ||
    hasTypedArrowParameters
  ) {
    return 'typescript';
  }

  if (hasTypedBinding && (hasTypedCollection || hasTupleAnnotation || hasImport || hasConst || hasLet || hasSemicolon)) {
    return 'typescript';
  }

  if (hasGenericCall && (hasImport || hasConst || hasLet)) {
    return 'typescript';
  }

  if (lines.length <= 3 && hasFunctionParameterTypes && hasFunctionReturnType) {
    return 'typescript';
  }

  return null;
};
