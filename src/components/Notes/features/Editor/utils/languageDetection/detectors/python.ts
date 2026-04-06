import type { LanguageDetector } from '../types';

export const detectPython: LanguageDetector = (ctx) => {
  const { firstLine, first100Lines, lines, hasCurlyBraces, hasSemicolon, code } = ctx;

  if (
    /\bswitch\s*\(/.test(code) && /\bcase\b/.test(code) && /[{}]/.test(code) ||
    /(?:^|\n)\s*[a-z_]\w*\([^ )\n]*[^\n]*\)\s*->/.test(code) ||
    /\blists:\w+\s*\(/.test(code) ||
    /^#include\s*[<"]/m.test(first100Lines) ||
    /\b(public|private|protected):\s*$/m.test(code) ||
    /\b(enum\s+class|virtual|override|noexcept|constexpr)\b/.test(code) ||
    /\bstd::/.test(code) ||
    /^package\s+[\w:]+;/m.test(first100Lines) ||
    /^import\s+static\s+java\./m.test(first100Lines) ||
    /^import\s+(?:java|javax|jakarta|javafx|lombok|org\.(?:springframework|junit|apache|jooq)|com\.(?:fasterxml|google|intellij))\./m.test(first100Lines) ||
    /^@(Override|Deprecated|SuppressWarnings|Test|RestController|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|Autowired|Component|Service|Repository|Controller|Entity|Table|Column|Id)\b/m.test(code) ||
    /^namespace\s+[A-Z]\w*(\\[A-Z]\w*)*;$/m.test(first100Lines) ||
    /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
    /\b(import\s+.*from|export\s+(default|const|function|class)|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/.test(first100Lines) ||
    /^require(?:_relative)?\s+['"]/.test(first100Lines) ||
    /require\s+["'].*spec_helper["']/.test(first100Lines) ||
    /\b(defmodule|defp|def\s+\w+.*\s+do\b|use\s+[A-Z]|alias\s+[A-Z])\b/.test(first100Lines) ||
    /(?:^|\n)\s*(?:extends\s+\w+|signal\s+\w+|export\s*\(|onready\s+var|func\s+_ready\(\))/m.test(first100Lines) ||
    /^\(ns\s+[\w.-]+|^\((def|defn|defmacro|deftask)\s+/m.test(first100Lines) ||
    (/^import\s+(qualified\s+)?[A-Z][\w.]*/m.test(first100Lines) &&
      /(::\s*[A-Z]|^data\s+[A-Z]|\bderiving\s*\()/m.test(code)) ||
    /^#!.*crystal/.test(firstLine)
  ) {
    return null;
  }

  if (firstLine.startsWith('# -*- coding:') || firstLine.startsWith('# coding:')) {
    return 'python';
  }

  const hasPythonImport =
    /^(?:from\s+[._a-z][\w.]*\s+import\s+|import\s+[a-z_][\w.]*(?:\s+as\s+\w+)?(?:\s*,\s*[a-z_][\w.]*(?:\s+as\s+\w+)?)*)/m.test(
      first100Lines,
    );
  const hasPythonDef = /\bdef\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code);
  const hasPythonAsyncDef =
    /\basync\s+def\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code);
  const hasPythonClass = /\bclass\s+\w+(?:\([^)\n]*\))?\s*:/.test(code);
  const hasPythonDecorator =
    /(?:^|\n)\s*@[a-z_]\w*(?:\.[a-z_]\w*)*(?:\([^)\n]*\))?\s*$/im.test(first100Lines);
  const hasPythonFlow = /(?:^|\n)\s*(?:if|elif|else|for|while|try|except|finally|with|match|case)\b[^\n]*:/.test(code);
  const hasPythonIndent = lines.slice(1, 25).some((line) => /^(?: {4,}|\t)\S/.test(line));
  const hasPythonLiterals = /\b(?:None|True|False|self|cls|__init__|__name__|__main__)\b/.test(code);
  const hasPythonComprehension =
    /(?:\[[^\]\n]*\bfor\b[^\]\n]*\bin\b[^\]\n]*\]|\{[^\}\n]*\bfor\b[^\}\n]*\bin\b[^\}\n]*\}|\([^)\n]*\bfor\b[^)\n]*\bin\b[^)\n]*\))/.test(
      code,
    );
  const hasPythonLambda = /\blambda\b[^\n:]*:/.test(code);
  const hasPythonYield = /\byield(?:\s+from)?\b/.test(code);
  const hasPythonFString = /(^|[^A-Za-z0-9_])(?:[rub]|br|rb)?f(?:"[^"\n]*\{|'[^'\n]*\{)/i.test(code);
  const hasPythonWalrus = /:=/.test(code);
  const hasPythonTypeAlias =
    /(?:^|\n)\s*type\s+[A-Z_]\w*\s*=\s*(?:dict|list|tuple|set|frozenset|str|int|float|bool|bytes|Callable|Iterable|Sequence|Mapping)\b/.test(
      code,
    );
  const hasPythonTypeHints =
    /(?:^|\n)\s*\w+\s*:\s*(?:str|int|bool|float|bytes|dict|list|tuple|set|None|Literal|Final|Protocol|[A-Z]\w*)(?:\[[^\]\n]+\])?/.test(
      code,
    ) || /\)\s*->\s*[A-Za-z_][^:\n]*\s*:/.test(code);
  const hasPythonTupleUnpack = /(?:^|\n)\s*\w+(?:\s*,\s*\*?\w+)+\s*=/.test(code);
  const hasPythonSlice = /\[[^\]\n]*:[^\]\n]*\]/.test(code);
  const hasPythonBuiltins =
    /\b(?:len|sum|min|max|any|all|enumerate|zip|isinstance|issubclass|print|range|sorted|open|list|dict|set|tuple|cast|namedtuple|select)\s*\(/.test(
      code,
    );
  const hasPythonTypingSymbol = /\b(?:Literal|Final|Protocol|TypeVar|overload|dataclass|cached_property|Enum|StrEnum)\b/.test(code);
  const hasPythonLibraryCall =
    /\b(?:Counter|defaultdict|deque|chain|lru_cache|suppress|Decimal|Fraction|NamedTemporaryFile|uuid4|ArgumentParser|FastAPI|BaseModel|JsonResponse|TypeVar|Literal)\s*\(/.test(
      code,
    );
  const hasPythonMemberCall =
    /\.(?:append|extend|pop|appendleft|get|setdefault|exists|read_text|write_text|unlink|strip|lower|upper|split|items|values|keys|json|head|desc|order_by|is_|filter|getLogger|add_argument|echo|raises|assertEqual|connect|execute|getenv|loads|join|now)\s*\(/.test(
      code,
    );
  const hasPythonFramework =
    /@(app|router|api)\.(route|get|post|put|delete|patch)\b/.test(code) ||
    /\b\w+\.objects\.(?:filter|all|get|create|update|delete)\s*\(/.test(code) ||
    /\b(?:pd|np|plt|pytest)\.\w+\s*\(/.test(code);
  const hasPythonAsyncUse = /\b(?:await|async\s+for|async\s+with)\b/.test(code);
  const hasPythonRaiseOrAssert = /(?:^|\n)\s*(?:raise|assert)\b/.test(code);
  const hasPythonWithOpen = /\bwith\s+open\s*\([^)\n]*\)\s+as\s+\w+\s*:/.test(code);
  const hasSimpleAssignment = /(?:^|\n)\s*[A-Za-z_]\w*(?:\s*,\s*\*?\w+)*\s*=/.test(code);

  if (/^print\s*\(\s*['"]/m.test(code) && !/;/.test(code)) {
    return 'python';
  }

  if (hasPythonTypeAlias || /__name__\s*==\s*['"]__main__['"]/.test(code) || hasPythonWalrus) {
    return 'python';
  }

  if (hasPythonDecorator && (hasPythonDef || hasPythonAsyncDef || hasPythonClass)) {
    return 'python';
  }

  if ((hasPythonDef || hasPythonAsyncDef) && (/^\s{4,}[A-Za-z_]\w+\s*=/m.test(code) || /^\s{4,}return\b/m.test(code))) {
    return 'python';
  }

  if (
    hasPythonImport &&
    (hasPythonDef ||
      hasPythonAsyncDef ||
      hasPythonClass ||
      hasPythonDecorator ||
      hasPythonFlow ||
      hasPythonLiterals ||
      hasPythonTypeHints ||
      hasPythonBuiltins ||
      hasPythonTypingSymbol ||
      hasPythonLibraryCall ||
      hasPythonMemberCall ||
      hasPythonFramework ||
      hasPythonAsyncUse)
  ) {
    return 'python';
  }

  if (
    (hasPythonAsyncDef || hasPythonDef) &&
    (hasPythonIndent || hasPythonFlow || hasPythonYield || hasPythonLiterals || hasPythonTypeHints || hasPythonAsyncUse)
  ) {
    return 'python';
  }

  if (hasPythonClass && (hasPythonIndent || hasPythonDecorator || hasPythonTypeHints || /(?:^|\n)\s*def\s+/.test(code))) {
    return 'python';
  }

  if (
    (hasPythonComprehension ||
      hasPythonLambda ||
      hasPythonYield ||
      hasPythonFString ||
      hasPythonRaiseOrAssert ||
      hasPythonTupleUnpack ||
      hasPythonSlice ||
      hasPythonWithOpen) &&
    !hasSemicolon
  ) {
    return 'python';
  }

  if (
    hasPythonFlow &&
    (hasPythonIndent || hasPythonBuiltins || hasPythonMemberCall || hasPythonLiterals || hasPythonTupleUnpack || hasPythonAsyncUse)
  ) {
    return 'python';
  }

  if (
    !hasSemicolon &&
    hasSimpleAssignment &&
    (hasPythonLiterals || hasPythonBuiltins || hasPythonTypingSymbol || hasPythonMemberCall || hasPythonTupleUnpack || hasPythonSlice || hasPythonLibraryCall)
  ) {
    return 'python';
  }

  let pythonScore = 0;

  if (hasPythonImport) pythonScore += 3;
  if (hasPythonDef || hasPythonAsyncDef) pythonScore += 3;
  if (hasPythonClass) pythonScore += 2;
  if (hasPythonDecorator) pythonScore += 2;
  if (hasPythonFlow) pythonScore += 2;
  if (hasPythonComprehension) pythonScore += 2;
  if (hasPythonLambda || hasPythonYield || hasPythonFString || hasPythonWalrus) pythonScore += 2;
  if (hasPythonLiterals) pythonScore += 2;
  if (hasPythonTypeHints || hasPythonTypeAlias || hasPythonTypingSymbol) pythonScore += 2;
  if (hasPythonBuiltins || hasPythonLibraryCall || hasPythonTypingSymbol) pythonScore += 1;
  if (hasPythonMemberCall || hasPythonFramework || hasPythonTupleUnpack || hasPythonSlice || hasPythonAsyncUse) {
    pythonScore += 1;
  }
  if (hasPythonIndent) pythonScore += 1;
  if (!hasSemicolon) pythonScore += 1;
  if (!hasCurlyBraces || hasPythonComprehension || hasPythonTypeHints || hasPythonMemberCall) pythonScore += 1;

  if (pythonScore >= 6) {
    return 'python';
  }

  return null;
};
