import type { LanguageDetector } from '../types';

const javaImportPattern =
  /^import\s+(?:static\s+)?(?:java|javax|jakarta|javafx|lombok|org\.(?:springframework|junit|apache|jooq|intellij)|com\.(?:fasterxml|google|intellij))\.[\w.*]+;$/m;

const javaAnnotationPattern =
  /(?:^|\n)\s*@(Override|Deprecated|SuppressWarnings|FunctionalInterface|SafeVarargs|Target|Retention|RestController|Controller|Service|Repository|Component|Autowired|GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping|Entity|Table|Column|Id|Embeddable|Test|BeforeEach|AfterEach)\b/m;

const javaTypePattern =
  /(?:^|\n)\s*(?:(?:public|protected|private)\s+)?(?:(?:abstract|final|sealed|non-sealed|static)\s+)*(?:class|interface|enum|record)\s+[A-Z]\w*(?:<[^>\n]+>)?(?:\s+extends\s+[^{\n]+)?(?:\s+implements\s+[^{\n]+)?(?:\s+permits\s+[^{\n]+)?\s*\{/m;

const javaMethodPattern =
  /(?:^|\n)\s*(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|strictfp)\s+)*(?:<[^\n]+>\s+)?(?:void|boolean|byte|short|int|long|float|double|char|String|Object|Optional<[^>\n]+>|List<[^>\n]+>|Map<[^>\n]+>|Set<[^>\n]+>|Stream<[^>\n]+>|CompletableFuture<[^>\n]+>|LocalDate|Instant|DateTimeFormatter|UUID|BigDecimal|Path|HttpRequest|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)\s+[a-z_]\w*\s*\([^)\n]*\)\s*(?:throws\s+[^{\n]+)?\s*(?:\{|;)/m;

const javaConstructorPattern =
  /(?:^|\n)\s*(?:(?:public|protected|private)\s+)?[A-Z]\w*\s*\([^)\n]*\)\s*(?:throws\s+[^{\n]+)?\s*\{/m;

const javaFieldPattern =
  /(?:^|\n)\s*(?:(?:public|protected|private|static|final|volatile|transient)\s+)+(?:boolean|byte|short|int|long|float|double|char|String|Object|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)\s+[A-Za-z_]\w*(?:\s*=\s*[^;\n]+)?\s*;/m;

const javaTypedFieldPattern =
  /(?:^|\n)\s*(?:String|boolean|byte|short|int|long|float|double|char|Optional<[^>\n]+>|List<[^>\n]+>|Map<[^>\n]+>|Set<[^>\n]+>|Stream<[^>\n]+>|CompletableFuture<[^>\n]+>|LocalDate|Instant|DateTimeFormatter|UUID|BigDecimal|Path|HttpRequest|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)\s+[A-Za-z_]\w*(?:\s*=\s*[^;\n]+)?\s*;/m;

const javaRuntimePattern =
  /\b(?:System\.(?:out|err)\.(?:print|println)|Integer\.parseInt|Objects\.equals|Path\.of|Files\.readString|UUID\.randomUUID|Instant\.parse|LocalDate\.now|DateTimeFormatter\.|HttpRequest\.newBuilder|new\s+StringBuilder|new\s+Thread|ObjectMapper\b|Optional\.(?:ofNullable|of|empty)|Stream\.(?:of|iterate|generate)|Collectors\.(?:toList|toSet|toMap|groupingBy)|Arrays\.asList|List\.of|Map\.of|Set\.of|CompletableFuture\.supplyAsync|synchronized\s*\(|instanceof\s+[A-Z]\w+\s+[a-z_]\w*|\.formatted\s*\()/;

const javaFlowPattern =
  /\b(?:for\s*\(\s*(?:final\s+)?(?:int|long|var|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)\s+\w+\s*(?::|=)|while\s*\(|switch\s*\(|try\s*(?:\([^)]*\))?\s*\{|catch\s*\(|finally\b)/;

const javaEnumPattern =
  /(?:^|\n)\s*(?:public\s+)?enum\s+[A-Z]\w*\s*\{[\s\S]*\b[A-Z][A-Z0-9_]*\b/m;

const javaRecordPattern =
  /(?:^|\n)\s*(?:public\s+)?record\s+[A-Z]\w*\s*\([^)\n]*\)\s*\{/m;

const javaAnnotationTypePattern =
  /(?:^|\n)\s*@interface\s+[A-Z]\w*\s*\{/m;

export const detectJava: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  if (
    /^using\s+[A-Z]/m.test(first100Lines) ||
    /^namespace\s+[\w.]+/m.test(first100Lines) ||
    /\b(public|private|protected):\s*$/m.test(code) ||
    /\btemplate\s*</.test(code) ||
    /\bstd::/.test(code) ||
    /\bexplicit\s+[A-Z]/.test(code) ||
    /(?:^|\n)\s*enum\s+\w+\s*\{[\s\S]*?\}\s*;/.test(code) ||
    /\b(get;\s*set;|init;|Console\.(?:Write|WriteLine)|async\s+Task|IEnumerable<|Dictionary<)\b/.test(code) ||
    /^import\s+.*\s+from\s+['"]/.test(first100Lines) ||
    /\b(?:export\s+(?:default|const|function|class)|module\.exports|require\s*\()/m.test(
      first100Lines,
    ) ||
    /(?:^|\n)\s*(?:async\s+def|def)\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code) ||
    /\bconstructor\s*\(/.test(code) ||
    /(?:^|\n)\s*class\s+\w+(?:\([^)\n]*\))?\s*:/.test(code) ||
    /^#include\s*[<"]/m.test(first100Lines) ||
    /^\s*@import\s+(Foundation|UIKit|CoreFoundation|CFNetwork)\s*;/m.test(first100Lines) ||
    /@(implementation|protocol|property|dynamic|synthesize|selector|autoreleasepool)\b/.test(code) ||
    /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
    /^require(?:_relative)?\s+['"]/.test(first100Lines) ||
    /\b(defmodule|defp)\b/.test(code) ||
    /\b(?:data\s+class|fun\s+\w+\s*\(|val\s+\w+\s*=|companion\s+object)\b/.test(code)
  ) {
    return null;
  }

  const hasJavaPackage = /^package\s+[\w.]+;$/m.test(first100Lines);
  const hasJavaImport = javaImportPattern.test(first100Lines);
  const hasJavaStaticImport = /^import\s+static\s+[\w.]+\.[A-Za-z_]\w*\s*;$/m.test(first100Lines);
  const hasJavaAnnotation = javaAnnotationPattern.test(code);
  const hasJavaType = javaTypePattern.test(code);
  const hasJavaMethod = javaMethodPattern.test(code);
  const hasJavaConstructor = javaConstructorPattern.test(code);
  const hasJavaField = javaFieldPattern.test(code) || javaTypedFieldPattern.test(code);
  const hasJavaRuntime = javaRuntimePattern.test(code);
  const hasJavaFlow = javaFlowPattern.test(code);
  const hasJavaRecord = javaRecordPattern.test(code);
  const hasJavaAnnotationType = javaAnnotationTypePattern.test(code);
  const hasJavaEnum = javaEnumPattern.test(code);
  const hasJavaInterfaceMethod =
    /(?:^|\n)\s*(?:public\s+)?interface\s+[A-Z]\w*(?:<[^>\n]+>)?(?:\s+extends\s+[^{\n]+)?\s*\{[\s\S]*?(?:void|boolean|byte|short|int|long|float|double|char|String|Object|[A-Z]\w*(?:<[^>\n]+>)?)\s+[a-z_]\w*\s*\([^)\n]*\)\s*;/m.test(
      code,
    );
  const hasJavaPermits = /\bpermits\b/.test(code);
  const hasJavaAnnotationsWithType =
    hasJavaAnnotation && (hasJavaType || hasJavaMethod || hasJavaConstructor || hasJavaField);

  if (/^import\s+static\s+java\./m.test(first100Lines)) {
    return 'java';
  }

  if (
    /^@(RestController|Controller|Service|Repository|Component|GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping|Entity|Table|Column|Id)\b/m.test(
      code,
    )
  ) {
    return 'java';
  }

  if (hasJavaPackage && (hasJavaImport || hasJavaType || hasJavaMethod || hasJavaField || hasJavaRecord)) {
    return 'java';
  }

  if (
    hasJavaImport &&
    (hasJavaType ||
      hasJavaMethod ||
      hasJavaConstructor ||
      hasJavaField ||
      hasJavaRuntime ||
      hasJavaFlow ||
      hasJavaAnnotation)
  ) {
    return 'java';
  }

  if (hasJavaStaticImport && (hasJavaType || hasJavaMethod || hasJavaRuntime)) {
    return 'java';
  }

  if (hasJavaAnnotationsWithType || (hasJavaAnnotation && hasJavaAnnotationType)) {
    return 'java';
  }

  if (hasJavaType && (hasJavaMethod || hasJavaConstructor || hasJavaField || hasJavaRuntime || hasJavaFlow || hasJavaPermits)) {
    return 'java';
  }

  if (hasJavaRecord && !(firstLine.trim().endsWith(';') || /\bwith\s*\{/.test(code))) {
    return 'java';
  }

  if (hasJavaInterfaceMethod || hasJavaAnnotationType) {
    return 'java';
  }

  if (
    hasJavaEnum &&
    !/\bexport\s+enum\b/.test(code) &&
    !/=\s*['"\d]/.test(code) &&
    !/\}\s*;/.test(code) &&
    !/\b[A-Z][A-Z0-9_]*\s*=/.test(code)
  ) {
    return 'java';
  }

  let score = 0;

  if (hasJavaPackage) score += 4;
  if (hasJavaImport) score += 4;
  if (hasJavaStaticImport) score += 3;
  if (hasJavaAnnotation) score += 2;
  if (hasJavaType) score += 2;
  if (hasJavaMethod) score += 2;
  if (hasJavaConstructor) score += 2;
  if (hasJavaField) score += 1;
  if (hasJavaRuntime) score += 2;
  if (hasJavaFlow) score += 1;
  if (hasJavaRecord || hasJavaEnum || hasJavaInterfaceMethod || hasJavaAnnotationType) score += 1;

  if (lines.length <= 3 && /\bSystem\.(?:out|err)\.(?:print|println)\s*\(/.test(code)) {
    return 'java';
  }

  if (score >= 5) {
    return 'java';
  }

  return null;
};
