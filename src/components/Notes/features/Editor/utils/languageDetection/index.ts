import type { DetectorConfig } from './types';
import { createContext, checkShebang } from './common';
// Core languages
import { detectPHP } from './detectors/php';
import { detectPython } from './detectors/python';
import { detectCPP } from './detectors/cpp';
import { detectJava } from './detectors/java';
import { detectGo } from './detectors/go';
import { detectRust } from './detectors/rust';
import { detectJavaScript } from './detectors/javascript';
import { detectRuby } from './detectors/ruby';
import { detectCSharp } from './detectors/csharp';
import { detectShell } from './detectors/shell';
import { detectSQL } from './detectors/sql';
import { detectHTML, detectMarkdown } from './detectors/markup';
import { detectCSS } from './detectors/css';
import { detectSwift } from './detectors/swift';
import { detectKotlin } from './detectors/kotlin';
import { detectDart } from './detectors/dart';
import { detectScala } from './detectors/scala';
// Config & Data formats
import { detectJSON } from './detectors/json';
import { detectYAML } from './detectors/yaml';
import { detectXML } from './detectors/xml';
import { detectTOML } from './detectors/toml';
import { detectDockerfile } from './detectors/dockerfile';
import { detectMakefile } from './detectors/makefile';
import { detectDotenv } from './detectors/dotenv';
import { detectGraphQL } from './detectors/graphql';
import { detectProtobuf } from './detectors/protobuf';
// Frontend frameworks
import { detectVue } from './detectors/vue';
import { detectSvelte } from './detectors/svelte';
import { detectAstro } from './detectors/astro';
import { detectMDX } from './detectors/mdx';
// Style languages
import { detectSass } from './detectors/sass';
import { detectLess } from './detectors/less';
import { detectStylus } from './detectors/stylus';
import { detectPostCSS } from './detectors/postcss';
// Template languages
import { detectHandlebars } from './detectors/handlebars';
import { detectPug } from './detectors/pug';
import { detectJinja } from './detectors/jinja';
import { detectLiquid } from './detectors/liquid';
import { detectTwig } from './detectors/twig';
import { detectHaml } from './detectors/haml';
// System & Tools
import { detectNginx } from './detectors/nginx';
import { detectApache } from './detectors/apache';
import { detectTerraform } from './detectors/terraform';
import { detectCMake } from './detectors/cmake';
import { detectPrisma } from './detectors/prisma';
// Additional languages
import { detectLua } from './detectors/lua';
import { detectPerl } from './detectors/perl';
import { detectR } from './detectors/r';
import { detectJulia } from './detectors/julia';
import { detectMatlab } from './detectors/matlab';
import { detectElixir } from './detectors/elixir';
import { detectErlang } from './detectors/erlang';
import { detectHaskell } from './detectors/haskell';
import { detectOCaml } from './detectors/ocaml';
import { detectFSharp } from './detectors/fsharp';
import { detectClojure } from './detectors/clojure';
import { detectElm } from './detectors/elm';
import { detectGroovy } from './detectors/groovy';
import { detectCrystal } from './detectors/crystal';
import { detectNim } from './detectors/nim';
import { detectZig } from './detectors/zig';
import { detectSolidity } from './detectors/solidity';
import { detectPowerShell } from './detectors/powershell';
import { detectLaTeX } from './detectors/latex';
import { detectVim } from './detectors/vim';
import { detectGDScript } from './detectors/gdscript';
import { detectCoffeeScript } from './detectors/coffeescript';
import { detectObjectiveC } from './detectors/objectivec';

const detectors: DetectorConfig[] = [
  // Priority 1: Shebang (highest priority)
  { name: 'shebang', priority: 1, detector: checkShebang },
  
  // Priority 2-10: Unique syntax & Config (must be before YAML)
  { name: 'php', priority: 2, detector: detectPHP },
  { name: 'dockerfile', priority: 3, detector: detectDockerfile },
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
  { name: 'jinja', priority: 24, detector: detectJinja },
  { name: 'twig', priority: 25, detector: detectTwig },
  // Handlebars moved to priority 9.3 (before HTML)
  
  // Priority 31-40: System config & JVM languages (before JavaScript)
  { name: 'apache', priority: 31, detector: detectApache },
  { name: 'nginx', priority: 32, detector: detectNginx },
  { name: 'kotlin', priority: 33, detector: detectKotlin },
  { name: 'scala', priority: 34, detector: detectScala },
  { name: 'groovy', priority: 35, detector: detectGroovy },
  { name: 'dart', priority: 36, detector: detectDart },
  { name: 'csharp', priority: 37, detector: detectCSharp },
  { name: 'solidity', priority: 38, detector: detectSolidity },
  // Priority 30-40: Functional languages (move before JavaScript)
  { name: 'haskell', priority: 30, detector: detectHaskell },
  { name: 'ocaml', priority: 31, detector: detectOCaml },
  { name: 'fsharp', priority: 39, detector: detectFSharp }, // Keep F# at 39
  { name: 'elixir', priority: 40, detector: detectElixir }, // Keep Elixir at 40
  
  // Priority 41-55: Top mainstream languages
  { name: 'clojure', priority: 40.5, detector: detectClojure }, // Move Clojure before JavaScript/Python
  { name: 'javascript', priority: 41, detector: detectJavaScript },
  { name: 'python', priority: 42, detector: detectPython },
  { name: 'java', priority: 43, detector: detectJava },
  { name: 'cpp', priority: 44, detector: detectCPP },
  { name: 'go', priority: 45, detector: detectGo },
  { name: 'rust', priority: 46, detector: detectRust },
  { name: 'ruby', priority: 47, detector: detectRuby },
  { name: 'swift', priority: 48, detector: detectSwift },
  { name: 'lua', priority: 49, detector: detectLua },
  { name: 'sql', priority: 50, detector: detectSQL },
  { name: 'shell', priority: 51, detector: detectShell },
  { name: 'r', priority: 52, detector: detectR }, // Move R after shell
  { name: 'julia', priority: 53, detector: detectJulia }, // Move Julia after R
  { name: 'matlab', priority: 54, detector: detectMatlab }, // Move MATLAB after Julia
  { name: 'elm', priority: 29, detector: detectElm }, // Move Elm before Haskell
  
  // Priority 66-75: Functional languages (moved to priority 30-31 and 40.5)
  { name: 'erlang', priority: 69, detector: detectErlang },
  
  // Priority 60-65: Systems & Low-level (move before functional languages)
  { name: 'nim', priority: 60, detector: detectNim },
  { name: 'crystal', priority: 61, detector: detectCrystal },
  { name: 'zig', priority: 62, detector: detectZig },
  { name: 'vim', priority: 63, detector: detectVim },
  { name: 'objective-c', priority: 64, detector: detectObjectiveC },
  { name: 'gdscript', priority: 65, detector: detectGDScript }, // Move GDScript here (before Perl)
  
  // Priority 76-85: Scripting languages
  { name: 'perl', priority: 76, detector: detectPerl },
  { name: 'powershell', priority: 77, detector: detectPowerShell },
  { name: 'vim', priority: 78, detector: detectVim },
  { name: 'coffeescript', priority: 79, detector: detectCoffeeScript },
  
  // Priority 86-95: Config & Tools
  { name: 'latex', priority: 86, detector: detectLaTeX },
  { name: 'terraform', priority: 87, detector: detectTerraform },
  { name: 'cmake', priority: 88, detector: detectCMake },
  { name: 'prisma', priority: 89, detector: detectPrisma },
  { name: 'dotenv', priority: 90, detector: detectDotenv },
  // Handlebars moved to priority 9.3 (before HTML)
  
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
