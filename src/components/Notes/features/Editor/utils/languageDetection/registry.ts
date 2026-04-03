import type { DetectorConfig } from './types.ts';
import { checkShebang } from './common.ts';
import { detectApache } from './detectors/apache.ts';
import { detectAstro } from './detectors/astro.ts';
import { detectClojure } from './detectors/clojure.ts';
import { detectCMake } from './detectors/cmake.ts';
import { detectCoffeeScript } from './detectors/coffeescript.ts';
import { detectCPP } from './detectors/cpp.ts';
import { detectCSharp } from './detectors/csharp.ts';
import { detectCrystal } from './detectors/crystal.ts';
import { detectCSS } from './detectors/css.ts';
import { detectDart } from './detectors/dart.ts';
import { detectDockerfile } from './detectors/dockerfile.ts';
import { detectDotenv } from './detectors/dotenv.ts';
import { detectElixir } from './detectors/elixir.ts';
import { detectElm } from './detectors/elm.ts';
import { detectErlang } from './detectors/erlang.ts';
import { detectFSharp } from './detectors/fsharp.ts';
import { detectGDScript } from './detectors/gdscript.ts';
import { detectGo } from './detectors/go.ts';
import { detectGraphQL } from './detectors/graphql.ts';
import { detectGroovy } from './detectors/groovy.ts';
import { detectHaml } from './detectors/haml.ts';
import { detectHandlebars } from './detectors/handlebars.ts';
import { detectHaskell } from './detectors/haskell.ts';
import { detectHTML, detectMarkdown } from './detectors/markup.ts';
import { detectJava } from './detectors/java.ts';
import { detectJavaScript } from './detectors/javascript.ts';
import { detectJinja } from './detectors/jinja.ts';
import { detectJSON } from './detectors/json.ts';
import { detectJulia } from './detectors/julia.ts';
import { detectKotlin } from './detectors/kotlin.ts';
import { detectLaTeX } from './detectors/latex.ts';
import { detectLess } from './detectors/less.ts';
import { detectLiquid } from './detectors/liquid.ts';
import { detectLua } from './detectors/lua.ts';
import { detectMakefile } from './detectors/makefile.ts';
import { detectMatlab } from './detectors/matlab.ts';
import { detectMDX } from './detectors/mdx.ts';
import { detectNginx } from './detectors/nginx.ts';
import { detectNim } from './detectors/nim.ts';
import { detectOCaml } from './detectors/ocaml.ts';
import { detectObjectiveC } from './detectors/objectivec.ts';
import { detectPerl } from './detectors/perl.ts';
import { detectPHP } from './detectors/php.ts';
import { detectPostCSS } from './detectors/postcss.ts';
import { detectPowerShell } from './detectors/powershell.ts';
import { detectPrisma } from './detectors/prisma.ts';
import { detectProlog } from './detectors/prolog.ts';
import { detectProtobuf } from './detectors/protobuf.ts';
import { detectPug } from './detectors/pug.ts';
import { detectPython } from './detectors/python.ts';
import { detectR } from './detectors/r.ts';
import { detectRuby } from './detectors/ruby.ts';
import { detectRust } from './detectors/rust.ts';
import { detectSass } from './detectors/sass.ts';
import { detectScala } from './detectors/scala.ts';
import { detectShell } from './detectors/shell.ts';
import { detectSolidity } from './detectors/solidity.ts';
import { detectSQL } from './detectors/sql.ts';
import { detectStylus } from './detectors/stylus.ts';
import { detectSvelte } from './detectors/svelte.ts';
import { detectSwift } from './detectors/swift.ts';
import { detectTerraform } from './detectors/terraform.ts';
import { detectTOML } from './detectors/toml.ts';
import { detectTwig } from './detectors/twig.ts';
import { detectTypeScript } from './detectors/typescript.ts';
import { detectVim } from './detectors/vim.ts';
import { detectVue } from './detectors/vue.ts';
import { detectXML } from './detectors/xml.ts';
import { detectYAML } from './detectors/yaml.ts';
import { detectZig } from './detectors/zig.ts';

export const detectorRegistry: readonly DetectorConfig[] = [
  { name: 'shebang', priority: 1, detector: checkShebang },
  { name: 'php', priority: 2, detector: detectPHP },
  { name: 'dockerfile', priority: 3, detector: detectDockerfile },
  { name: 'dotenv', priority: 3.5, detector: detectDotenv },
  { name: 'makefile', priority: 4, detector: detectMakefile },
  { name: 'json', priority: 5, detector: detectJSON },
  { name: 'yaml', priority: 6, detector: detectYAML },
  { name: 'toml', priority: 7, detector: detectTOML },
  { name: 'vue', priority: 8, detector: detectVue },
  { name: 'svelte', priority: 9, detector: detectSvelte },
  { name: 'astro', priority: 9.2, detector: detectAstro },
  { name: 'handlebars', priority: 9.3, detector: detectHandlebars },
  { name: 'mdx', priority: 9.5, detector: detectMDX },
  { name: 'html', priority: 10, detector: detectHTML },
  { name: 'apache', priority: 10.5, detector: detectApache },
  { name: 'xml', priority: 11, detector: detectXML },
  { name: 'sass', priority: 12, detector: detectSass },
  { name: 'less', priority: 13, detector: detectLess },
  { name: 'stylus', priority: 14, detector: detectStylus },
  { name: 'postcss', priority: 15, detector: detectPostCSS },
  { name: 'css', priority: 16, detector: detectCSS },
  { name: 'graphql', priority: 18, detector: detectGraphQL },
  { name: 'protobuf', priority: 19, detector: detectProtobuf },
  { name: 'pug', priority: 21, detector: detectPug },
  { name: 'haml', priority: 22, detector: detectHaml },
  { name: 'liquid', priority: 23, detector: detectLiquid },
  { name: 'twig', priority: 23.5, detector: detectTwig },
  { name: 'jinja', priority: 24, detector: detectJinja },
  { name: 'elm', priority: 29, detector: detectElm },
  { name: 'haskell', priority: 30, detector: detectHaskell },
  { name: 'ocaml', priority: 31.3, detector: detectOCaml },
  { name: 'fsharp', priority: 31.5, detector: detectFSharp },
  { name: 'nginx', priority: 32, detector: detectNginx },
  { name: 'rust', priority: 32.5, detector: detectRust },
  { name: 'kotlin', priority: 33, detector: detectKotlin },
  { name: 'scala', priority: 34, detector: detectScala },
  { name: 'groovy', priority: 35, detector: detectGroovy },
  { name: 'swift', priority: 35.5, detector: detectSwift },
  { name: 'dart', priority: 36, detector: detectDart },
  { name: 'nim', priority: 36.2, detector: detectNim },
  { name: 'julia', priority: 36.5, detector: detectJulia },
  { name: 'solidity', priority: 36.7, detector: detectSolidity },
  { name: 'lua', priority: 37, detector: detectLua },
  { name: 'csharp', priority: 37.5, detector: detectCSharp },
  { name: 'go', priority: 38, detector: detectGo },
  { name: 'zig', priority: 38.5, detector: detectZig },
  { name: 'viml', priority: 39, detector: detectVim },
  { name: 'java', priority: 39.5, detector: detectJava },
  { name: 'elixir', priority: 40, detector: detectElixir },
  { name: 'objectivec', priority: 40.05, detector: detectObjectiveC },
  { name: 'crystal', priority: 40.1, detector: detectCrystal },
  { name: 'ruby', priority: 40.2, detector: detectRuby },
  { name: 'clojure', priority: 40.5, detector: detectClojure },
  { name: 'python', priority: 40.7, detector: detectPython },
  { name: 'typescript', priority: 40.8, detector: detectTypeScript },
  { name: 'javascript', priority: 41, detector: detectJavaScript },
  { name: 'cpp', priority: 44, detector: detectCPP },
  { name: 'powershell', priority: 49, detector: detectPowerShell },
  { name: 'perl', priority: 49.5, detector: detectPerl },
  { name: 'sql', priority: 50, detector: detectSQL },
  { name: 'shell', priority: 51, detector: detectShell },
  { name: 'latex', priority: 51.5, detector: detectLaTeX },
  { name: 'r', priority: 52, detector: detectR },
  { name: 'matlab', priority: 54, detector: detectMatlab },
  { name: 'gdscript', priority: 65, detector: detectGDScript },
  { name: 'erlang', priority: 69, detector: detectErlang },
  { name: 'prolog', priority: 70, detector: detectProlog },
  { name: 'coffeescript', priority: 79, detector: detectCoffeeScript },
  { name: 'terraform', priority: 87, detector: detectTerraform },
  { name: 'cmake', priority: 88, detector: detectCMake },
  { name: 'prisma', priority: 89, detector: detectPrisma },
  { name: 'markdown', priority: 106, detector: detectMarkdown },
];
