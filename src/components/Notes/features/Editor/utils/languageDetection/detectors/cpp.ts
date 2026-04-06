import type { LanguageDetector } from '../types';

export const detectCPP: LanguageDetector = (ctx) => {
  const { first100Lines, sample, code } = ctx;
  const hasCppAccessModifier = /\b(public|private|protected):\s*$/m.test(code);
  const cppOnlyHeaderPattern = /#include\s*<(algorithm|array|atomic|chrono|condition_variable|deque|filesystem|format|forward_list|fstream|functional|future|initializer_list|iomanip|iosfwd|iostream|istream|list|map|memory|mutex|optional|ostream|queue|random|ranges|regex|set|shared_mutex|source_location|span|sstream|stack|stop_token|string|string_view|syncstream|thread|tuple|type_traits|unordered_map|unordered_set|utility|variant|vector)>/;
  const hasCppExclusiveSyntax = /\b(constexpr|decltype|namespace|template|typename|concept|requires|mutable)\b/.test(code) ||
    /\boperator\s*(?:[+\-*/%<>=!]+|\(\)|\[\])/.test(code) ||
    /\b(?:const\s+)?[A-Za-z_]\w*(?:::\w+)?\s*&\s*[A-Za-z_]\w*/.test(code);

  if (/^[A-Za-z_][\w-]*="[^"]*"/m.test(first100Lines) && /\bprintf\s*\(/.test(code) && code.includes('$')) {
    return null;
  }

  // Helper variables
  const hasDoubleColon = sample.includes('::');
  const hasClass = sample.includes('class');

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return null;
  }

  if (/\b(val|def|var)\s+\w+/.test(first100Lines)) {
    if (/\b(trans|Picture|draw|forward|right|repeat|import\s+scala)\b/.test(code)) {
      return null;
    }
  }

  if (/\b(proc|iterator|template|macro)\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/^namespace\s+[A-Z]\w*(\\[A-Z]\w*)*;$/m.test(first100Lines) &&
      /^\s*(class|interface|trait|enum)\s+[A-Z]\w*/m.test(code)) {
    return null;
  }

  if (/\b(console\.(log|error|warn)|alert\(|document\.|window\.|require\(|module\.exports|exports\.|import\s+.*from|export\s+(default|const|function)|Object\.defineProperty|var\s+\w+\s*=\s*function)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(CREATE\s+TABLE|INSERT\s+INTO|SELECT\s+.*\s+FROM|DROP\s+TABLE|SHOW\s+WARNINGS|CREATE\s+INDEX|CREATE\s+UNIQUE\s+INDEX)\b/i.test(first100Lines)) {
    return null;
  }

  const varCount = (first100Lines.match(/\bvar\s+\w+\s*=/g) || []).length;
  if (varCount >= 5) {
    return null;
  }

  if (/\bfunction\s+\w+\s*\(/.test(first100Lines)) {
    if (!/#include\s*[<"]/.test(first100Lines) &&
        !/\b(printf|scanf|malloc|free|sizeof|std::|cout|cin)\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/<-/.test(first100Lines) && /\bfunction\s*\(/.test(first100Lines)) {
    return null;
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && /\bend\b/.test(code)) {
    return null;
  }

  if (/^(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+\w+;|part\s+['"])/m.test(first100Lines)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=|module\s+\w+\s*=|open\s+\w+)\b/.test(first100Lines) && /\bin\b/.test(code)) {
    return null;
  }

  if (/\b(datasource|model)\s+\w+\s*\{/.test(first100Lines)) {
    if (/@(id|default|unique|relation)|provider\s*=|url\s*=/.test(code)) {
      return null;
    }
  }

  if (/\benum\s+class\s+\w+/.test(code)) {
    return 'cpp';
  }

  if (/^#\s*(define|ifdef|ifndef|elif|else|endif)\b/m.test(first100Lines) || /\btypedef\s+struct\b/.test(code) || /\bunion\s+\w+\s*\{/.test(code) || /\bextern\s+\w/.test(code) || /\bvolatile\s+\w/.test(code) || /\brestrict\b/.test(code) || /\bstatic\s+inline\b/.test(code) || /\b(int|char|float|double|short|long|unsigned|signed|void)\s+\w+\s*\([^)]*\)\s*\{/.test(code) || /\bconst\s+char\s*\*\s*\w+\s*\([^)]*\)\s*\{/.test(code) || /\bdo\s*\{[\s\S]*\}\s*while\s*\(/.test(code) || /^enum\s+\w+\s*\{/m.test(code) || /^struct\s+\w+\s*\{/m.test(code) || /^typedef\s+.*\(\*\w+\)\(/m.test(code) || /\[[0-9]+\]\s*=/.test(code)) {
    if (!hasDoubleColon &&
        !sample.includes('class') &&
        !sample.includes('template') &&
        !sample.includes('namespace') &&
        !hasCppExclusiveSyntax) {
      return 'c';
    }
  }

  if (cppOnlyHeaderPattern.test(first100Lines)) {
    return 'cpp';
  }

  if (/\bstd::(ifstream|ofstream|fstream|stringstream|istringstream|ostringstream|getline|shared_ptr|weak_ptr|unique_ptr|enable_shared_from_this|make_shared|make_unique|format|clamp|jthread|stop_token|future|promise|packaged_task|lock_guard|unique_lock|scoped_lock|filesystem|path|optional|variant|visit|expected)\b/.test(code)) {
    return 'cpp';
  }

  if (/\b(class|struct)\s+\w+(?:\s+final)?\s*:\s*(public|private|protected)\b/.test(code)) {
    return 'cpp';
  }

  if (/^namespace\s+\w+(::\w+)+\s*\{/m.test(code)) {
    return 'cpp';
  }

  if (/\b(?:virtual|override|noexcept)\b/.test(code) && (hasCppAccessModifier || /\b(class|struct)\s+\w+/.test(code) || /^#include\s*[<"]/m.test(first100Lines))) {
    return 'cpp';
  }

  if (/=\s*(delete|default)\s*;/.test(code)) {
    return 'cpp';
  }

  if (/\boperator\s*(?:[+\-*/%<>=!]+|\(\)|\[\])/.test(code)) {
    return 'cpp';
  }

  if (/\[\s*[^\]]*\]\s*\([^)]*\)\s*mutable\b/.test(code)) {
    return 'cpp';
  }

  // C++ class definition
  if (/^class\s+\w+\s*\{/m.test(code) || /^class\s+\w+\s*$/m.test(code)) {
    if (/#include\s*[<"]/.test(first100Lines) ||
        hasCppAccessModifier ||
        /\b(std::|cout|cin|vector|template|namespace)\b/.test(code)) {
      return 'cpp';
    }
  }

  if (/\bstd::(cout|cin|cerr|endl|string|vector|map|set|list|queue|stack|pair|make_pair|shared_ptr|unique_ptr|move|forward|find_if|for_each|transform|accumulate)\b/.test(first100Lines)) {
    return 'cpp';
  }

  if (/<<|>>/.test(code) && /\b(cout|cin|cerr|endl)\b/.test(code)) {
    return 'cpp';
  }

  if (/\bauto\s+\w+\s*=\s*std::/.test(first100Lines)) {
    return 'cpp';
  }

  if (/\bauto\s+\w+\s*=.*\[.*\]\s*\(/.test(first100Lines)) {
    return 'cpp';
  }

  if (/\btemplate\s*<\s*typename\s+\w+\s*>/.test(first100Lines)) {
    return 'cpp';
  }

  if (/\btemplate\s*<[^>]+>\s+\w+\s+\w+/.test(code)) {
    return 'cpp';
  }

  if (/\bconstexpr\s+\w+/.test(code)) {
    return 'cpp';
  }

  if (/\bauto\s+\[[\w,\s]+\]\s*=/.test(code)) {
    return 'cpp';
  }

  if (/\bstd::make_tuple/.test(code)) {
    return 'cpp';
  }

  if (/^enum\s+\w+/m.test(first100Lines)) {
    if (sample.includes('class') || sample.includes('namespace') || sample.includes('template') || hasDoubleColon) {
      return 'cpp';
    }
    return 'c';
  }

  if (/#include\s*[<"]/ .test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof|NULL)\b/.test(first100Lines)) {
    if (/^[A-Za-z_][\w-]*="[^"]*"/m.test(first100Lines) && /\bprintf\b/.test(code) && code.includes("$")) {
      return null;
    }
    if (/@(interface|implementation|property|protocol)\b/.test(code) ||
        /\bNS[A-Z]\w+\s*\*/.test(first100Lines) ||
        /#import\s+<(Foundation|UIKit|CoreFoundation|CFNetwork)\//.test(first100Lines)) {
      return null;
    }

    if (/#include\s+<(IOKit|CoreVideo|CoreGraphics|ApplicationServices)\//.test(first100Lines)) {
      if (/\b(CF|CG|IO|CV)[A-Z]\w+\s*\(/.test(code)) {
        return 'objectivec';
      }
    }

    if (cppOnlyHeaderPattern.test(first100Lines) ||
        /\b(std::|cout|cin|vector|template|class|namespace|new\s+\w+|delete\s+\w+|using\s+namespace)\b/.test(first100Lines) ||
        (/\bstring\b/.test(first100Lines) && !/<string\.h>/.test(first100Lines))) {
      return 'cpp';
    }
    if (/\b(printf|scanf|struct\s+\w+|typedef)\b/.test(first100Lines) && !hasDoubleColon && !sample.includes('class')) {
      return 'c';
    }
    if (/#include\s*<\w+\.h>/.test(first100Lines) && !sample.includes('std::') && !sample.includes('class')) {
      return 'c';
    }

    if (/\btypedef\s+(struct|enum)\b/.test(first100Lines) && !hasDoubleColon && !sample.includes('class') && !sample.includes('template')) {
      return 'c';
    }

    if (!hasDoubleColon && !sample.includes('class') && !sample.includes('template') && !sample.includes('namespace') && !cppOnlyHeaderPattern.test(first100Lines)) {
      return 'c';
    }
    return 'cpp';
  }

  if (/\b(struct|typedef|enum)\s+\w+/.test(first100Lines) && /\b(int|char|float|double|void)\s+\w+/.test(first100Lines)) {
    if (sample.includes('::') || sample.includes('class') || sample.includes('template')) {
      return 'cpp';
    }
    return 'c';
  }

  if (/^enum\s+\w+/m.test(first100Lines) && /\{[\s\S]*?\}/.test(code)) {
    if (sample.includes('::') || sample.includes('class') || sample.includes('template') || sample.includes('namespace')) {
      return 'cpp';
    }
    return 'cpp';
  }

  if ((/\b(protected|private|public)\s*:/.test(first100Lines) || hasCppAccessModifier) && hasClass) {
    if (!sample.includes('alert(') && !sample.includes('super.')) {
      return 'cpp';
    }
  }

  return null;
};
