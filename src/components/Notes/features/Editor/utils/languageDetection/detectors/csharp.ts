import type { LanguageDetector } from '../types';

export const detectCSharp: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, hasCurlyBraces, hasSemicolon } = ctx;

  if (
    /#import\s+["<]/.test(first100Lines) ||
    /@(interface|implementation|property|protocol)\b/.test(first100Lines) ||
    /\bNS[A-Z]\w+\s*\*/.test(first100Lines) ||
    firstLine.trim() === '---' ||
    /^package\s+[\w.]+;/m.test(first100Lines) ||
    /^import\s+static\s+[\w.]+\.[A-Za-z_]\w*\s*;$/m.test(first100Lines) ||
    /^import\s+(?:java|javax|jakarta|org\.|com\.)/m.test(first100Lines) ||
    /(?:^|\n)\s*(?:public|protected|private)?\s*String\s+[a-z_]\w*\s*\(/m.test(code) ||
    /(?:^|\n)\s*(?:public|protected|private)\s+String\s+[a-z_]\w*\s*(?:=|;)/m.test(code) ||
    /\bstatic\s+final\b/.test(code) ||
    /@(RestController|RequestMapping|GetMapping|PostMapping|Autowired|Component|Service|Repository|Controller|Entity|Table)\b/.test(code) ||
    /(?:^|\n)\s*@(Override|Deprecated|SuppressWarnings|FunctionalInterface|SafeVarargs|Test|BeforeEach|AfterEach)\b/m.test(code) ||
    /\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+|part\s+['"])/.test(first100Lines) ||
    /^#include\s*[<"]/m.test(first100Lines) ||
    /(?:^|\n)\s*enum\s+\w+\s*\{[\s\S]*?\}\s*;/.test(code) ||
    /\bstd::/.test(code) ||
    /\btemplate\s*</.test(code) ||
    /\b(public|private|protected):\s*$/m.test(code) ||
    /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
    /^open\s+[A-Z][\w.]*/m.test(first100Lines) ||
    /\b(fn\s+main|pub\s+fn|impl\s+\w+|let\s+mut\b|use\s+std::)\b/.test(first100Lines) ||
    /(?:^|\n)\s*(?:async\s+def|def)\s+\w+\s*\([^)]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code) ||
    /(?:^|\n)\s*class\s+\w+(?:\([^)\n]*\))?\s*:\s*(?:#.*)?$/m.test(code) ||
    /^import\s+(Foundation|UIKit|SwiftUI|Combine)\b/m.test(first100Lines) ||
    /(?:^|\n)\s*(?:class|struct|enum)\s+\w+\s*:\s*(?:NSObject|Codable|Hashable|Identifiable|CaseIterable|Equatable)\b/m.test(code) ||
    /(?:^|\n)\s*(?:let|var)\s+\w+\s*:\s*(?:\[[^\]\n]+\]|[A-Z][\w.<>?]*)/.test(code) ||
    /\bfunc\s+\w+\s*\(/.test(code) ||
    /\bguard\s+let\b/.test(code) ||
    /\bmodule\.exports\b|\bexport\s+(default|const|function|class)\b|\bimport\s+.*\s+from\s+['"]/m.test(first100Lines) ||
    /\b(?:extends|implements)\b/.test(code) ||
    /\b(?:System\.(?:out|err)\.(?:print|println)|Integer\.parseInt|new\s+StringBuilder|new\s+Thread|instanceof\b|synchronized\s*\(|\.formatted\s*\()/.test(code) ||
    /\breturn\s+switch\s*\(|\bcase\s+[^:\n]+->/.test(code)
  ) {
    return null;
  }

  const hasQueryXml = firstLine.includes('<Query Kind=');
  const hasUsingDirective =
    /^using\s+(?:static\s+)?[A-Z][\w.]*(?:\s*=\s*[A-Z][\w.]*)?;$/m.test(first100Lines) ||
    /^using\s+(?:System|Microsoft|Xunit|NUnit\.Framework|FluentAssertions|Moq|Serilog|MediatR|AutoMapper)(?:\.[A-Z][\w]*)*;$/m.test(
      first100Lines,
    );
  const hasNamespace = /^namespace\s+[A-Z][\w.]*(?:\s*\{|;)/m.test(first100Lines);
  const hasAttribute =
    /(?:^|\n)\s*\[(?:assembly:\s*)?(?:Obsolete|Serializable|ApiController|Route|Http(?:Get|Post|Put|Delete|Patch)|Fact|Theory|InlineData|Test|TestFixture|TestClass|TestMethod|SetUp|TearDown|FromBody|FromQuery|Required|GeneratedRegex|JsonPropertyName)\b/.test(
      code,
    );
  const hasNamedType =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|abstract|sealed|static|partial|readonly|unsafe|ref)\s+)*(?:class|interface|struct|record)\s+[A-ZI]\w*(?:<[^>\n]+>)?/m.test(
      code,
    );
  const hasEnumDecl = /(?:^|\n)\s*(?:(?:public|private|protected|internal)\s+)?enum\s+[A-Z]\w*\s*\{/m.test(code);
  const hasRecordPrimary =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|sealed|readonly)\s+)*record(?:\s+struct)?\s+[A-Z]\w*\s*\([^)]*\)\s*[;{]/m.test(
      code,
    );
  const hasUnambiguousRecordPrimary =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|sealed|readonly)\s+)+record(?:\s+struct)?\s+[A-Z]\w*\s*\([^)]*\)\s*[;{]/m.test(
      code,
    );
  const hasRecordStruct = /(?:^|\n)\s*(?:public\s+)?(?:readonly\s+)?record\s+struct\s+[A-Z]\w*\s*\(/m.test(code);
  const hasTypeDeclaration = hasNamedType || hasEnumDecl || hasRecordPrimary;
  const hasEnumValues = /\benum\s+[A-Z]\w*\s*\{[\s\S]*?[A-Za-z]\w*\s*=\s*\d+/.test(code);
  const hasDelegate =
    /(?:^|\n)\s*(?:public\s+)?delegate\s+(?:void|[A-Z]\w*(?:<[^>\n]+>)?)\s+[A-Z]\w*\s*\([^)]*\)\s*;/m.test(code);
  const hasBaseClause =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|abstract|sealed|static|partial|readonly|unsafe|ref)\s+)*(?:class|interface|struct|record)\s+[A-ZI]\w*(?:<[^>\n]+>)?\s*:\s*[^\n{]+/m.test(
      code,
    );
  const hasTypeModifier = /\b(?:partial\s+class|readonly\s+struct|unsafe\s+class|ref\s+struct)\b/.test(code);
  const hasMemberModifier = /\b(?:protected\s+internal|virtual|override|sealed\s+override|required)\b/.test(code);
  const hasFieldModifier = /\b(?:readonly|const|required)\b/.test(code);
  const hasProperty =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|required|readonly)\s+)*(?:string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|ActionResult(?:<[^>\n]+>)?|IActionResult|Span<[^>\n]+>|ReadOnlySpan<[^>\n]+>|I[A-Z]\w*(?:<[^>\n]+>)?|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)(?:\?)?\s+[A-Za-z_]\w*\s*\{\s*get;\s*(?:set;|init;|private\s+set;|protected\s+set;|internal\s+set;)\s*\}(?:\s*=\s*[^;\n]+;)?/m.test(
      code,
    );
  const hasInterfaceMethod =
    /(?:^|\n)\s*interface\s+[A-ZI]\w*(?:<[^>\n]+>)?(?:\s*:\s*[^\n{]+)?\s*\{[\s\S]*?(?:void|string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|I[A-Z]\w*(?:<[^>\n]+>)?|[A-Z]\w*(?:<[^>\n]+>)?)(?:\?)?\s+[A-Za-z_]\w*\s*\([^)]*\)\s*;/m.test(
      code,
    );
  const hasIndexer = /(?:^|\n)\s*(?:public|private|protected|internal)\s+[^\n{]+\s+this\[[^\]]+\]\s*\{[\s\S]*?(?:get\s*=>|get;)/m.test(code);
  const hasField =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|readonly|const|required)\s+)+(?:string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|Dictionary<[^>\n]+>|List<[^>\n]+>|Queue<[^>\n]+>|HashSet<[^>\n]+>|ConcurrentDictionary<[^>\n]+>|I[A-Z]\w*(?:<[^>\n]+>)?|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)(?:\?)?\s+_?[A-Za-z]\w*\s*(?:=|;)/m.test(
      code,
    );
  const hasConstructor = /(?:^|\n)\s*(?:(?:public|private|protected|internal)\s+)[A-Z]\w*\s*\([^)]*\)\s*(?::\s*[^\n{]+)?\s*\{/m.test(code);
  const hasMethod =
    /(?:^|\n)\s*(?:(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|async|partial|unsafe|extern|new|params|in|ref)\s+)*)?(?:void|string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|ActionResult(?:<[^>\n]+>)?|IActionResult|IAsyncEnumerable<[^>\n]+>|IEnumerable<[^>\n]+>|Span<[^>\n]+>|ReadOnlySpan<[^>\n]+>|\([^)\n]+\)|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?|T)(?:\?)?\s+[A-Za-z_]\w*(?:<[^>\n]+>)?\s*\([^)]*\)\s*(?:=>|\{|where\s+[A-Z]|;)/m.test(
      code,
    );
  const hasNullableTypeSignature =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|required|readonly)\s+)*(?:string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|ActionResult(?:<[^>\n]+>)?|IActionResult|I[A-Z]\w*(?:<[^>\n]+>)?|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)\?\s+[A-Za-z_]\w*(?:\s*\(|\s*(?:=>|=|;|\{))/m.test(
      code,
    );
  const hasExpressionBodiedMember =
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|async)\s+)*(?:void|string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|ActionResult(?:<[^>\n]+>)?|IActionResult|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)(?:\?)?\s+[A-Za-z_]\w*(?:<[^>\n]+>)?\s*\([^)]*\)\s*=>/m.test(
      code,
    ) ||
    /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|required|readonly)\s+)*(?:void|string|int|bool|double|float|decimal|object|Guid|DateTime|Task(?:<[^>\n]+>)?|ValueTask(?:<[^>\n]+>)?|ActionResult(?:<[^>\n]+>)?|IActionResult|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)(?:\?)?\s+[A-Za-z_]\w*\s*=>/m.test(
      code,
    );
  const hasOperatorSyntax = /\?\?=|\?\.|\$"|@"/.test(code);
  const hasParameterModifier = /\b(?:params|in)\s+(?:string|int|bool|double|float|decimal|object|Guid|DateTime|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)\b/.test(code);
  const hasLocalFunction = /\n\s{4,}(?:void|string|int|bool|double|float|decimal|object|Guid|DateTime|[A-Z]\w*(?:<[^>\n]+>)?(?:\[\])?)(?:\?)?\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{/.test(code);
  const hasNullForgiving = /null!/.test(code);
  const hasGenericConstraint = /\bwhere\s+[A-Z]\w*\s*:\s*(?:class|struct|notnull|new\(\)|[A-Z]\w*)/.test(code);
  const hasTupleSignature = /(?:^|\n)\s*\((?:int|string|bool|Guid|DateTime|[A-Z]\w*)(?:\s+\w+)?\s*,\s*(?:int|string|bool|Guid|DateTime|[A-Z]\w*)(?:\s+\w+)?\)\s+[A-Za-z_]\w*\s*\(/m.test(code);
  const hasPatternMatching = /\bis\s+string\s+\w+|\bis\s*\{|\bswitch\s*\{|\bcase\s+>\s*\d+\s+and\s+</.test(code);
  const hasRuntime =
    /\b(?:Console\.(?:WriteLine|Write|ReadLine)|Task\.(?:Delay|FromResult|CompletedTask)|File\.(?:OpenRead|ReadAllText|WriteAllText|Exists)|Path\.Combine|JsonSerializer\.Serialize|Guid\.NewGuid|DateTime\.UtcNow|Environment\.GetEnvironmentVariable|Regex\.IsMatch|Assert\.(?:Equal|That|AreEqual)|Results\.Ok|WebApplication\.CreateBuilder|Parallel\.ForEachAsync|ImmutableArray\.Create|Array\.Empty<|nameof\(|stackalloc\b|yield\s+return|await\s+using\s+var|using\s+var|out\s+var|var\s*\(|with\s*\{|\?\?=|\?\.|\$"|@"|\.\.[\^\d]|\[[^\]]+\]\s*=|\bthis\[[^\]]+\]\s*\{|logger\.LogInformation|services\.AddScoped<|configuration\.GetSection\(|ControllerBase\b|ActionResult<|IServiceCollection\b|ILogger<|IConfiguration\b|checked\s*\{)/.test(
      code,
    );
  const hasLinq = /\b(?:System\.Linq|\.Where\(|\.Select\(|\.OrderBy\(|\.ThenBy\(|\.ToArray\(|from\s+\w+\s+in\s+\w+\s+where\s+)/.test(code);
  const hasEvent = /(?:^|\n)\s*public\s+event\s+[A-Z][\w.<>?]+\s+[A-Z]\w*\s*;/m.test(code);
  const hasConversionOrOperator = /\b(?:implicit|explicit)\s+operator\b|\bpublic\s+static\s+[A-Z]\w*(?:<[^>\n]+>)?(?:\?)?\s+operator\s*(?:[+\-*/<>=!]+|true|false)\s*\(/.test(code);
  const hasRefUnsafe = /\b(?:unsafe\s+class|fixed\s*\(|ref\s+int\s+|scoped\s+ReadOnlySpan<|ref\s+struct\b)/.test(code);

  if (hasQueryXml) {
    return 'csharp';
  }

  if (/\[(ApiController|Route|Http(Get|Post|Put|Delete|Patch))/.test(code) && /\bControllerBase\b/.test(code)) {
    return 'csharp';
  }

  if (hasUnambiguousRecordPrimary || hasRecordStruct || hasDelegate || hasEnumValues) {
    return 'csharp';
  }

  if (hasUsingDirective && (hasNamespace || hasTypeDeclaration || hasMethod || hasProperty || hasRuntime || hasLinq)) {
    return 'csharp';
  }

  if (hasNamespace && (hasTypeDeclaration || hasMethod || hasProperty || hasField || hasRuntime)) {
    return 'csharp';
  }

  if (hasAttribute && (hasTypeDeclaration || hasMethod || hasProperty || hasNamespace || hasUsingDirective)) {
    return 'csharp';
  }

  if (
    hasTypeDeclaration &&
    (hasProperty ||
      (hasField && hasFieldModifier) ||
      (hasConstructor && (hasBaseClause || hasFieldModifier || hasUsingDirective)) ||
      hasInterfaceMethod ||
      hasPatternMatching ||
      hasRuntime ||
      hasOperatorSyntax ||
      hasParameterModifier ||
      hasLocalFunction ||
      hasNullForgiving ||
      hasGenericConstraint ||
      hasEvent ||
      hasConversionOrOperator ||
      hasRefUnsafe ||
      hasBaseClause ||
      hasTypeModifier ||
      hasMemberModifier ||
      hasNullableTypeSignature ||
      hasExpressionBodiedMember)
  ) {
    return 'csharp';
  }

  if (hasIndexer || hasTupleSignature) {
    return 'csharp';
  }

  let score = 0;
  if (hasUsingDirective) score += 3;
  if (hasNamespace) score += 3;
  if (hasAttribute) score += 2;
  if (hasTypeDeclaration) score += 2;
  if (hasProperty) score += 2;
  if (hasField) score += 1;
  if (hasConstructor) score += 1;
  if (hasMethod || hasInterfaceMethod) score += 2;
  if (hasBaseClause) score += 1;
  if (hasTypeModifier || hasMemberModifier || hasFieldModifier) score += 1;
  if (hasNullableTypeSignature) score += 1;
  if (hasExpressionBodiedMember) score += 1;
  if (hasOperatorSyntax || hasParameterModifier || hasLocalFunction || hasNullForgiving) score += 1;
  if (hasGenericConstraint) score += 1;
  if (hasTupleSignature) score += 1;
  if (hasPatternMatching) score += 1;
  if (hasRuntime) score += 2;
  if (hasLinq) score += 1;
  if (hasEvent || hasConversionOrOperator || hasRefUnsafe || hasEnumValues) score += 1;

  if (!hasCurlyBraces && !hasSemicolon && !hasDelegate && !hasRecordStruct && !hasRecordPrimary) {
    return null;
  }

  if (score >= 6) {
    return 'csharp';
  }

  return null;
};
