import type { LanguageDetector } from '../types';

export const detectKotlin: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, hasCurlyBraces, hasSemicolon, lines } = ctx;

  if (lines.length <= 3 && /^println\s*\(/.test(code.trim())) {
    if (/\^\d+/.test(code)) {
      return null;
    }

    return 'kotlin';
  }

  if (
    /#import\s+["<]/.test(first100Lines) ||
    /@(interface|implementation|property|protocol)\b/.test(first100Lines) ||
    /\bNS[A-Z]\w+\s*\*/.test(first100Lines) ||
    /^using\s+[A-Z]/m.test(first100Lines) ||
    /^namespace\s+[\w.]+/m.test(first100Lines) ||
    /\b(get;\s*set;|init;|Console\.(?:Write|WriteLine)|async\s+Task|IEnumerable<|Dictionary<|ControllerBase\b|ActionResult<)\b/.test(code) ||
    /^package\s+[\w.]+;/m.test(first100Lines) ||
    /^import\s+(?:static\s+)?(?:java|javax|jakarta|org\.|com\.)/m.test(first100Lines) ||
    /@(RestController|RequestMapping|GetMapping|PostMapping|Autowired|Component|Service|Repository|Controller|Entity|Table)\b/.test(code) ||
    /(?:^|\n)\s*@(Override|FunctionalInterface|SafeVarargs|BeforeEach|AfterEach)\b/.test(code) ||
    /^import\s+(Foundation|SwiftUI|UIKit|Combine)\b/m.test(first100Lines) ||
    /\bguard\s+let\b/.test(code) ||
    /\bfunc\s+\w+\s*\(/.test(code) ||
    /\b(?:some\s+View|@State|@Published)\b/.test(code) ||
    /(?:^|\n)\s*(?:class|struct|enum)\s+\w+\s*:\s*(?:NSObject|Codable|Hashable|Identifiable|CaseIterable|Equatable|View)\b/m.test(code) ||
    /(?:^|\n)\s*(?:let|var)\s+\w+\s*:\s*(?:\[[^\]\n]+\]|[A-Z][\w.<>?]*)/.test(code) ||
    /\bcase\s+class\b/.test(code) ||
    /\bsealed\s+trait\b/.test(code) ||
    /\bobject\s+\w+\s+extends\b/.test(code) ||
    /\bdef\s+\w+\s*\(/.test(code) ||
    /\bmatch\s*\{/.test(code) ||
    /\bgiven\b|\busing\s*\(/.test(code) ||
    /^#include\s*[<"]/m.test(first100Lines) ||
    /\bstd::/.test(code) ||
    /\btemplate\s*</.test(code)
  ) {
    return null;
  }

  const hasKotlinPackage = /^package\s+[\w.]+$/m.test(first100Lines);
  const hasKotlinImport = /^import\s+(?:kotlin|kotlinx|androidx?|io\.ktor|org\.jetbrains|java\.time|java\.util|java\.io)\.[\w.*]+$/m.test(first100Lines);
  const hasDataClass = /(?:^|\n)\s*data\s+class\s+[A-Z]\w*(?:<[^>\n]+>)?\s*\([^)]*\b(?:val|var)\s+\w+\s*:/m.test(code);
  const hasSealedType = /\bsealed\s+(?:class|interface)\s+[A-Z]\w*/.test(code);
  const hasEnumClass = /(?:^|\n)\s*enum\s+class\s+[A-Z]\w*/.test(code);
  const hasObjectDecl = /(?:^|\n)\s*(?:data\s+)?object\s+[A-Z]\w*(?:\s*:\s*[^\n{]+)?\s*\{/m.test(code);
  const hasCompanionObject = /\bcompanion\s+object\b/.test(code);
  const hasFunInterface = /\bfun\s+interface\s+[A-Z]\w*/.test(code);
  const hasAnnotationClass = /\bannotation\s+class\s+[A-Z]\w*/.test(code);
  const hasValueClass = /\b(?:value|data)\s+class\s+[A-Z]\w*\s*@?/.test(code) && /@JvmInline/.test(code);
  const hasPrimaryClass =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|open|abstract|sealed|data|final)\s+)*class\s+[A-Z]\w*(?:<[^>\n]+>)?(?:\s*\([^)]*\))?(?:\s*:\s*[^\n{]+)?\s*\{/m.test(
      code,
    );
  const hasPrimaryConstructorParams = /class\s+[A-Z]\w*(?:<[^>\n]+>)?\s*\([^)]*\b(?:val|var)\s+\w+\s*:/.test(code);
  const hasInterfaceDecl = /(?:^|\n)\s*(?:(?:public|private|protected|internal|sealed|fun)\s+)*interface\s+[A-Z]\w*(?:<[^>\n]+>)?\s*(?:\{|:\s*[^\n{]+\{)/m.test(code);
  const hasFunction =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|inline|tailrec|operator|infix|override|abstract|open|final|suspend|external)\s+)*fun(?:\s*<[^>\n]+>)?\s+(?:[A-Z]\w*(?:<[^>\n]+>)?\.)?[A-Za-z_]\w*\s*\([^)]*\)\s*(?::\s*[^={\n]+)?\s*(?:\{|=)/m.test(
      code,
    );
  const hasOverrideFun = /\boverride\s+fun\s+\w+/.test(code);
  const hasProperty =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|override|lateinit|const)\s+)*(?:val|var)\s+\w+(?::\s*[^=\n{]+)?(?:\s*=\s*[^;\n]+)?(?:\s+by\s+\w+(?:\([^)]*\))?)?/m.test(
      code,
    );
  const hasPropertySetter = /\bprivate\s+set\b/.test(code);
  const hasNullSafety = /\?\.|!!|\?:|\bas\?\b|\bis\s+null\b/.test(code);
  const hasWhenExpression = /\bwhen\s*\(/.test(code);
  const hasStringTemplate = /"[^"\n]*\$[A-Za-z_\{]/.test(code);
  const hasRuntime =
    /\b(?:println\(|listOf\(|mutableListOf\(|mapOf\(|mutableMapOf\(|setOf\(|mutableSetOf\(|emptyList\(|emptyMap\(|sequenceOf\(|flowOf\(|runCatching\s*\{|coroutineScope\s*\{|launch\s*\{|async\s*\{|mutableStateOf\(|isNullOrBlank\(|requireNotNull\(|checkNotNull\(|buildList\s*\{|buildMap\s*\{|lazy\s*\{|withContext\(|collect\s*\{|firstOrNull\(|getOrNull\()/m.test(
      code,
    );
  const hasLambdaChain = /\.(?:map|flatMap|filter|associate|groupBy|forEach|fold)\s*\{/.test(code);
  const hasTypeAlias = /\btypealias\s+[A-Z]\w*\s*=/.test(code);
  const hasNullableType = /:\s*[A-Z][\w.<>]*\?/.test(code) || /:\s*(?:String|Int|Long|Boolean|Double|Float|Any)\?/.test(code);

  if (hasDataClass || hasEnumClass || hasFunInterface || hasAnnotationClass || hasValueClass) {
    return 'kotlin';
  }

  if (hasKotlinPackage && hasKotlinImport && (hasFunction || hasProperty || hasPrimaryClass || hasObjectDecl || hasInterfaceDecl)) {
    return 'kotlin';
  }

  if (hasSealedType && (hasWhenExpression || hasObjectDecl || hasDataClass || hasFunction)) {
    return 'kotlin';
  }

  if (hasCompanionObject && (hasPrimaryClass || hasFunction || hasProperty)) {
    return 'kotlin';
  }

  if (hasFunction && (hasNullSafety || hasWhenExpression || hasStringTemplate || hasRuntime || hasLambdaChain || hasNullableType || !hasSemicolon)) {
    return 'kotlin';
  }

  if ((hasPrimaryClass || hasInterfaceDecl || hasObjectDecl) && (hasProperty || hasOverrideFun || hasRuntime || hasLambdaChain || hasStringTemplate || hasPropertySetter || hasPrimaryConstructorParams) && !hasSemicolon) {
    return 'kotlin';
  }

  if (!hasCurlyBraces && !hasDataClass && !hasEnumClass && !hasFunInterface && !hasAnnotationClass) {
    return null;
  }

  let score = 0;
  if (hasKotlinPackage) score += 2;
  if (hasKotlinImport) score += 2;
  if (hasDataClass || hasEnumClass || hasFunInterface || hasAnnotationClass || hasValueClass) score += 4;
  if (hasSealedType) score += 2;
  if (hasPrimaryClass || hasObjectDecl || hasInterfaceDecl) score += 2;
  if (hasPrimaryConstructorParams) score += 2;
  if (hasFunction || hasOverrideFun) score += 2;
  if (hasProperty || hasPropertySetter) score += 1;
  if (hasNullSafety || hasNullableType) score += 1;
  if (hasWhenExpression) score += 1;
  if (hasStringTemplate) score += 1;
  if (hasRuntime || hasLambdaChain) score += 2;
  if (hasTypeAlias || hasCompanionObject) score += 1;
  if (!hasSemicolon) score += 1;

  if (score >= 5) {
    return 'kotlin';
  }

  return null;
};
