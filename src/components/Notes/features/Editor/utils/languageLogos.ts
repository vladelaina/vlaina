/**
 * Mapping of language IDs to their full-color logos
 * Using a mix of Devicons and Material Icon Theme for maximum compatibility and VS Code feel.
 */

const DEVICON_BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
const MATERIAL_BASE = 'https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/master/icons';

const LOGO_MAPPING: Record<string, string> = {
    // Top 20 Mainstream Languages (All verified)
    'html': `${DEVICON_BASE}/html5/html5-original.svg`,
    'css': `${DEVICON_BASE}/css3/css3-original.svg`,
    'javascript': `${DEVICON_BASE}/javascript/javascript-plain.svg`,
    'typescript': `${DEVICON_BASE}/typescript/typescript-plain.svg`,
    'python': `${DEVICON_BASE}/python/python-original.svg`,
    'java': `${DEVICON_BASE}/java/java-original.svg`,
    'c': `${DEVICON_BASE}/c/c-original.svg`,
    'cpp': `${DEVICON_BASE}/cplusplus/cplusplus-original.svg`,
    'csharp': `${DEVICON_BASE}/csharp/csharp-original.svg`,
    'go': `${DEVICON_BASE}/go/go-original-wordmark.svg`,
    'rust': `${DEVICON_BASE}/rust/rust-original.svg`,
    'php': `${DEVICON_BASE}/php/php-original.svg`,
    'ruby': `${DEVICON_BASE}/ruby/ruby-original.svg`,
    'swift': `${DEVICON_BASE}/swift/swift-original.svg`,
    'kotlin': `${DEVICON_BASE}/kotlin/kotlin-original.svg`,
    'sql': `${MATERIAL_BASE}/database.svg`,
    'bash': `${DEVICON_BASE}/bash/bash-original.svg`,
    'json': `${MATERIAL_BASE}/json.svg`,
    'jsonc': `${MATERIAL_BASE}/json.svg`,
    'yaml': `${MATERIAL_BASE}/yaml.svg`,
    'markdown': `${MATERIAL_BASE}/markdown.svg`,

    // Additional Languages (Verified to exist in Material Icon Theme or Devicon)
    'apache': `${DEVICON_BASE}/apache/apache-original.svg`,
    'astro': `${MATERIAL_BASE}/astro.svg`,
    'clojure': `${DEVICON_BASE}/clojure/clojure-original.svg`,
    'cmake': `${MATERIAL_BASE}/cmake.svg`,
    'coffee': `${DEVICON_BASE}/coffeescript/coffeescript-original.svg`,
    'coffeescript': `${DEVICON_BASE}/coffeescript/coffeescript-original.svg`,
    'crystal': `${DEVICON_BASE}/crystal/crystal-original.svg`,
    'dart': `${DEVICON_BASE}/dart/dart-original.svg`,
    'diff': `${MATERIAL_BASE}/diff.svg`,
    'docker': `${DEVICON_BASE}/docker/docker-original.svg`,
    'dockerfile': `${DEVICON_BASE}/docker/docker-original.svg`,
    'dotenv': `${MATERIAL_BASE}/dotenv.svg`,
    'elixir': `${DEVICON_BASE}/elixir/elixir-original.svg`,
    'elm': `${MATERIAL_BASE}/elm.svg`,
    'erlang': `${DEVICON_BASE}/erlang/erlang-original.svg`,
    'fortran-fixed-form': `${DEVICON_BASE}/fortran/fortran-original.svg`,
    'fortran-free-form': `${DEVICON_BASE}/fortran/fortran-original.svg`,
    'fsharp': `${DEVICON_BASE}/fsharp/fsharp-original.svg`,
    'fortran': `${DEVICON_BASE}/fortran/fortran-original.svg`,
    'gdscript': `${DEVICON_BASE}/godot/godot-original.svg`,
    'git-commit': `${DEVICON_BASE}/git/git-original.svg`,
    'git-rebase': `${DEVICON_BASE}/git/git-original.svg`,
    'graphql': `${DEVICON_BASE}/graphql/graphql-plain.svg`,
    'groovy': `${DEVICON_BASE}/groovy/groovy-original.svg`,
    'haml': `${MATERIAL_BASE}/haml.svg`,
    'handlebars': `${DEVICON_BASE}/handlebars/handlebars-original.svg`,
    'haskell': `${DEVICON_BASE}/haskell/haskell-original.svg`,
    'hcl': `${MATERIAL_BASE}/hcl.svg`,
    'ini': `${MATERIAL_BASE}/settings.svg`,
    'jinja': `${MATERIAL_BASE}/jinja.svg`,
    'json5': `${MATERIAL_BASE}/json.svg`,
    'julia': `${DEVICON_BASE}/julia/julia-original.svg`,
    'kubernetes': `${DEVICON_BASE}/kubernetes/kubernetes-plain.svg`,
    'latex': `${MATERIAL_BASE}/tex.svg`,
    'less': `${DEVICON_BASE}/less/less-plain-wordmark.svg`,
    'liquid': `${MATERIAL_BASE}/liquid.svg`,
    'log': `${MATERIAL_BASE}/log.svg`,
    'lua': `${DEVICON_BASE}/lua/lua-original.svg`,
    'make': `${MATERIAL_BASE}/makefile.svg`,
    'makefile': `${MATERIAL_BASE}/makefile.svg`,
    'matlab': `${DEVICON_BASE}/matlab/matlab-original.svg`,
    'mdx': `${MATERIAL_BASE}/markdown.svg`,
    'nginx': `${DEVICON_BASE}/nginx/nginx-original.svg`,
    'nim': `${DEVICON_BASE}/nim/nim-original.svg`,
    'nix': `${DEVICON_BASE}/nixos/nixos-original.svg`,
    'objective-c': `${DEVICON_BASE}/objectivec/objectivec-plain.svg`,
    'objective-cpp': `${DEVICON_BASE}/objectivec/objectivec-plain.svg`,
    'ocaml': `${DEVICON_BASE}/ocaml/ocaml-original.svg`,
    'perl': `${DEVICON_BASE}/perl/perl-original.svg`,
    'postcss': `${DEVICON_BASE}/postcss/postcss-original.svg`,
    'powershell': `${DEVICON_BASE}/powershell/powershell-original.svg`,
    'prisma': `${MATERIAL_BASE}/prisma.svg`,
    'proto': `${MATERIAL_BASE}/protobuf.svg`,
    'protobuf': `${MATERIAL_BASE}/protobuf.svg`,
    'pug': `${DEVICON_BASE}/pug/pug-original.svg`,
    'purescript': `${DEVICON_BASE}/purescript/purescript-original.svg`,
    'r': `${DEVICON_BASE}/r/r-original.svg`,
    'razor': `${MATERIAL_BASE}/razor.svg`,
    'sass': `${DEVICON_BASE}/sass/sass-original.svg`,
    'scala': `${DEVICON_BASE}/scala/scala-original.svg`,
    'scss': `${DEVICON_BASE}/sass/sass-original.svg`,
    'shellscript': `${DEVICON_BASE}/bash/bash-original.svg`,
    'solidity': `${DEVICON_BASE}/solidity/solidity-original.svg`,
    'stylus': `${DEVICON_BASE}/stylus/stylus-original.svg`,
    'svelte': `${DEVICON_BASE}/svelte/svelte-original.svg`,
    'terraform': `${DEVICON_BASE}/terraform/terraform-original.svg`,
    'tex': `${MATERIAL_BASE}/tex.svg`,
    'toml': `${MATERIAL_BASE}/toml.svg`,
    'tsx': `${DEVICON_BASE}/react/react-original.svg`,
    'jsx': `${DEVICON_BASE}/react/react-original.svg`,
    'twig': `${MATERIAL_BASE}/twig.svg`,
    'vim': `${DEVICON_BASE}/vim/vim-original.svg`,
    'viml': `${DEVICON_BASE}/vim/vim-original.svg`,
    'vue': `${DEVICON_BASE}/vuejs/vuejs-original.svg`,
    'vue-html': `${DEVICON_BASE}/vuejs/vuejs-original.svg`,
    'vue-vine': `${DEVICON_BASE}/vuejs/vuejs-original.svg`,
    'wasm': `${DEVICON_BASE}/wasm/wasm-original.svg`,
    'xml': `${MATERIAL_BASE}/xml.svg`,
    'zig': `${DEVICON_BASE}/zig/zig-original.svg`,
};

// Aliases and Shiki-to-Logo Mapping
const ALIAS_MAPPING: Record<string, string> = {
    // Common aliases
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'rs': 'rust',
    'cs': 'csharp',
    'sh': 'bash',
    'zsh': 'bash',
    'objc': 'objective-c',
    'yml': 'yaml',
    'md': 'markdown',
    'mdx': 'mdx',
    'docker': 'docker',
    'dockerfile': 'docker',
    'jsonc': 'json',
    'mysql': 'sql',
    'postgresql': 'sql',
    'ps1': 'powershell',
    'gql': 'graphql',
    'kt': 'kotlin',
    'tf': 'terraform',
    'k8s': 'kubernetes',
    'f#': 'fsharp',
    'apacheconf': 'apache',
    'assembly': 'asm',
    'elisp': 'emacs-lisp',
    'fortran-fixed-form': 'fortran-fixed-form',
    'fortran-free-form': 'fortran-free-form',
    'f': 'fortran-fixed-form',
    'for': 'fortran-fixed-form',
    'f77': 'fortran-fixed-form',
    'f90': 'fortran-free-form',
    'f95': 'fortran-free-form',
    'f03': 'fortran-free-form',
    'f08': 'fortran-free-form',
    'f18': 'fortran-free-form',
    'git-commit-message': 'git-commit',
    'git-rebase-message': 'git-rebase',
    'lisp': 'common-lisp',
    'vb': 'visualbasic',
    'vbnet': 'visualbasic',
    'typescript-with-tags': 'typescript',
    'wasm-interface-types': 'wit',
    'vue-template': 'vue',
    'vue-html': 'vue-html',
    'vue-vine': 'vue-vine',
    'hbs': 'handlebars',
    'jade': 'pug',
    'shell': 'shellscript',
    'styl': 'stylus',
    'lit': 'ts-tags',
    'vim': 'viml',
    'vimscript': 'viml',
};

export function getLanguageLogo(langId: string): { url: string; className?: string } | null {
    if (!langId) return null;
    const id = langId.toLowerCase().trim();
    const targetId = ALIAS_MAPPING[id] || id;
    
    const url = LOGO_MAPPING[targetId];
    if (url) {
        let className = "";
        // Languages that need inversion in dark mode (black/dark icons)
        const invertList = [
            'rust', 'bash', 'markdown', 'vim', 'viml', 'latex', 'tex', 'shellscript', 'zig',
            'nim', 'crystal', 'sass', 'scss', 'stylus', 'pug', 'postcss', 'purescript', 'nix'
        ];
        if (invertList.includes(targetId)) {
            className = "dark:invert dark:brightness-150";
        }
        return { url, className };
    }
    
    return null;
}