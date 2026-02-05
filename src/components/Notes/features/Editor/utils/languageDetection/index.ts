import type { DetectorConfig } from './types.ts';
import { createContext, checkShebang } from './common.ts';
// Core languages
import { detectPHP } from './detectors/php.ts';
import { detectPython } from './detectors/python.ts';
import { detectCPP } from './detectors/cpp.ts';
import { detectJava } from './detectors/java.ts';
import { detectGo } from './detectors/go.ts';
import { detectRust } from './detectors/rust.ts';
import { detectJavaScript } from './detectors/javascript.ts';
import { detectTypeScript } from './detectors/typescript.ts';
import { detectRuby } from './detectors/ruby.ts';
import { detectCSharp } from './detectors/csharp.ts';
import { detectShell } from './detectors/shell.ts';
import { detectSQL } from './detectors/sql.ts';
import { detectHTML, detectMarkdown } from './detectors/markup.ts';
import { detectCSS } from './detectors/css.ts';
import { detectSwift } from './detectors/swift.ts';
import { detectKotlin } from './detectors/kotlin.ts';
import { detectDart } from './detectors/dart.ts';
import { detectScala } from './detectors/scala.ts';
// Config & Data formats
import { detectJSON } from './detectors/json.ts';
import { detectYAML } from './detectors/yaml.ts';
import { detectXML } from './detectors/xml.ts';
import { detectTOML } from './detectors/toml.ts';
import { detectDockerfile } from './detectors/dockerfile.ts';
import { detectMakefile } from './detectors/makefile.ts';
import { detectDotenv } from './detectors/dotenv.ts';
import { detectGraphQL } from './detectors/graphql.ts';
import { detectProtobuf } from './detectors/protobuf.ts';
// Frontend frameworks
import { detectVue } from './detectors/vue.ts';
import { detectSvelte } from './detectors/svelte.ts';
import { detectAstro } from './detectors/astro.ts';
import { detectMDX } from './detectors/mdx.ts';
// Style languages
import { detectSass } from './detectors/sass.ts';
import { detectLess } from './detectors/less.ts';
import { detectStylus } from './detectors/stylus.ts';
import { detectPostCSS } from './detectors/postcss.ts';
// Template languages
import { detectHandlebars } from './detectors/handlebars.ts';
import { detectPug } from './detectors/pug.ts';
import { detectJinja } from './detectors/jinja.ts';
import { detectLiquid } from './detectors/liquid.ts';
import { detectTwig } from './detectors/twig.ts';
import { detectHaml } from './detectors/haml.ts';
// System & Tools
import { detectNginx } from './detectors/nginx.ts';
import { detectApache } from './detectors/apache.ts';
import { detectTerraform } from './detectors/terraform.ts';
import { detectCMake } from './detectors/cmake.ts';
import { detectPrisma } from './detectors/prisma.ts';
// Additional languages
import { detectLua } from './detectors/lua.ts';
import { detectPerl } from './detectors/perl.ts';
import { detectR } from './detectors/r.ts';
import { detectJulia } from './detectors/julia.ts';
import { detectMatlab } from './detectors/matlab.ts';
import { detectElixir } from './detectors/elixir.ts';
import { detectErlang } from './detectors/erlang.ts';
import { detectHaskell } from './detectors/haskell.ts';
import { detectOCaml } from './detectors/ocaml.ts';
import { detectFSharp } from './detectors/fsharp.ts';
import { detectClojure } from './detectors/clojure.ts';
import { detectElm } from './detectors/elm.ts';
import { detectGroovy } from './detectors/groovy.ts';
import { detectCrystal } from './detectors/crystal.ts';
import { detectNim } from './detectors/nim.ts';
import { detectZig } from './detectors/zig.ts';
import { detectSolidity } from './detectors/solidity.ts';
import { detectPowerShell } from './detectors/powershell.ts';
import { detectLaTeX } from './detectors/latex.ts';
import { detectVim } from './detectors/vim.ts';
import { detectGDScript } from './detectors/gdscript.ts';
import { detectCoffeeScript } from './detectors/coffeescript.ts';
import { detectObjectiveC } from './detectors/objectivec.ts';
import { detectProlog } from './detectors/prolog.ts';

const detectors: DetectorConfig[] = [
  // Priority 1: Shebang (highest priority)
  { name: 'shebang', priority: 1, detector: checkShebang },
  
  // Priority 2-10: Unique syntax & Config (must be before YAML)
  { name: 'php', priority: 2, detector: detectPHP },
  { name: 'dockerfile', priority: 3, detector: detectDockerfile },
  { name: 'dotenv', priority: 3.5, detector: detectDotenv }, // Move Dotenv before Makefile
  { name: 'makefile', priority: 4, detector: detectMakefile },
  { name: 'json', priority: 5, detector: detectJSON },
  { name: 'yaml', priority: 6, detector: detectYAML },
  { name: 'toml', priority: 7, detector: detectTOML },
  { name: 'vue', priority: 8, detector: detectVue }, // Move Vue before HTML
  { name: 'svelte', priority: 9, detector: detectSvelte }, // Move Svelte before HTML
  { name: 'astro', priority: 9.2, detector: detectAstro }, // Move Astro before HTML
  { name: 'handlebars', priority: 9.3, detector: detectHandlebars }, // Move Handlebars before HTML
  { name: 'mdx', priority: 9.5, detector: detectMDX }, // MDX before HTML
  { name: 'html', priority: 10, detector: detectHTML },
  { name: 'apache', priority: 10.5, detector: detectApache }, // Move Apache before XML
  { name: 'xml', priority: 11, detector: detectXML },
  { name: 'sass', priority: 12, detector: detectSass }, // Move Sass before CSS
  { name: 'less', priority: 13, detector: detectLess }, // Move Less before CSS
  { name: 'stylus', priority: 14, detector: detectStylus }, // Move Stylus before CSS
  { name: 'postcss', priority: 15, detector: detectPostCSS }, // Move PostCSS before CSS
  { name: 'css', priority: 16, detector: detectCSS },
  
  // Priority 17-25: Frontend frameworks & GraphQL
  // Astro moved to priority 9.2 (before HTML)
  { name: 'graphql', priority: 18, detector: detectGraphQL },
  { name: 'protobuf', priority: 19, detector: detectProtobuf },
  
  // Priority 21-30: Template languages
  { name: 'pug', priority: 21, detector: detectPug },
  { name: 'haml', priority: 22, detector: detectHaml },
  { name: 'liquid', priority: 23, detector: detectLiquid }, // Move Liquid before Jinja
  { name: 'twig', priority: 23.5, detector: detectTwig },
  { name: 'jinja', priority: 24, detector: detectJinja },
  
  { name: 'elm', priority: 29, detector: detectElm },
  { name: 'haskell', priority: 30, detector: detectHaskell }, // Move Haskell before OCaml (to catch imports early)
  { name: 'ocaml', priority: 31.3, detector: detectOCaml }, // Move OCaml before F#
  { name: 'fsharp', priority: 31.5, detector: detectFSharp },
  { name: 'nginx', priority: 32, detector: detectNginx },
  { name: 'rust', priority: 32.5, detector: detectRust }, // Move Rust before Scala (to catch trait early)
  { name: 'kotlin', priority: 33, detector: detectKotlin },
  { name: 'scala', priority: 34, detector: detectScala },
  { name: 'groovy', priority: 35, detector: detectGroovy },
  { name: 'swift', priority: 35.5, detector: detectSwift }, // Move Swift before Dart (to catch SwiftUI early)
  { name: 'dart', priority: 36, detector: detectDart },
  { name: 'nim', priority: 36.2, detector: detectNim }, // Move Nim before Lua
  { name: 'julia', priority: 36.5, detector: detectJulia }, // Move Julia before Lua
  { name: 'solidity', priority: 36.7, detector: detectSolidity },
  { name: 'lua', priority: 37, detector: detectLua },
  { name: 'csharp', priority: 37.5, detector: detectCSharp },
  { name: 'go', priority: 38, detector: detectGo }, // Move Go before Zig (to catch goroutines early)
  { name: 'zig', priority: 38.5, detector: detectZig },
  { name: 'vim', priority: 39, detector: detectVim },
  { name: 'java', priority: 39.5, detector: detectJava },
  { name: 'elixir', priority: 40, detector: detectElixir },
  { name: 'objectivec', priority: 40.05, detector: detectObjectiveC }, // Move Objective-C before Crystal
  { name: 'crystal', priority: 40.1, detector: detectCrystal }, // Move Crystal before Ruby
  { name: 'ruby', priority: 40.2, detector: detectRuby },
  
  { name: 'clojure', priority: 40.5, detector: detectClojure },
  { name: 'python', priority: 40.7, detector: detectPython }, // Python before TypeScript/JavaScript
  { name: 'typescript', priority: 40.8, detector: detectTypeScript }, // TypeScript before JavaScript
  { name: 'javascript', priority: 41, detector: detectJavaScript },
  { name: 'cpp', priority: 44, detector: detectCPP },
  { name: 'powershell', priority: 49, detector: detectPowerShell }, // Move PowerShell before Perl
  { name: 'perl', priority: 49.5, detector: detectPerl },
  { name: 'sql', priority: 50, detector: detectSQL },
  { name: 'shell', priority: 51, detector: detectShell },
  { name: 'latex', priority: 51.5, detector: detectLaTeX }, // Move LaTeX before R
  { name: 'r', priority: 52, detector: detectR },
  { name: 'matlab', priority: 54, detector: detectMatlab },
  { name: 'gdscript', priority: 65, detector: detectGDScript },
  { name: 'erlang', priority: 69, detector: detectErlang },
  { name: 'prolog', priority: 70, detector: detectProlog },
  { name: 'coffeescript', priority: 79, detector: detectCoffeeScript },
  { name: 'terraform', priority: 87, detector: detectTerraform },
  { name: 'cmake', priority: 88, detector: detectCMake },
  { name: 'prisma', priority: 89, detector: detectPrisma },
  
  // Priority 96-105: Game & Special
  // GDScript moved to priority 65 (before Perl)
  
  // Priority 106: Markdown (lowest priority - catches everything)
  { name: 'markdown', priority: 106, detector: detectMarkdown },
];

export function guessLanguage(code: string): string | null {
  if (!code || !code.trim()) {
    return null;
  }
  
  const ctx = createContext(code);
  const sortedDetectors = detectors.sort((a, b) => a.priority - b.priority);
  
  for (const { detector } of sortedDetectors) {
    const result = detector(ctx);
    if (result) {
      return result;
    }
  }
  
  return null;
}

export { createContext } from './common';
export type { DetectionContext, LanguageDetector } from './types';
