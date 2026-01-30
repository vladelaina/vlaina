/**
 * Mapping of language IDs to their full-color logos
 * Using a mix of Devicons and Material Icon Theme for maximum compatibility and VS Code feel.
 */

const DEVICON_BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
const MATERIAL_BASE = 'https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/master/icons';

const LOGO_MAPPING: Record<string, string> = {
    // Top 20 Mainstream
    'html': `${DEVICON_BASE}/html5/html5-original.svg`,
    'css': `${DEVICON_BASE}/css3/css3-original.svg`,
    'javascript': `${DEVICON_BASE}/javascript/javascript-original.svg`,
    'typescript': `${DEVICON_BASE}/typescript/typescript-original.svg`,
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
    'yaml': `${MATERIAL_BASE}/yaml.svg`,
    'markdown': `${MATERIAL_BASE}/markdown.svg`,

    // Extensive Language Support (Verified & Fixed)
    'abap': `${MATERIAL_BASE}/abap.svg`,
    'actionscript': `${MATERIAL_BASE}/actionscript.svg`,
    'ada': `${MATERIAL_BASE}/ada.svg`,
    'angular-html': `${MATERIAL_BASE}/angular.svg`,
    'angular-ts': `${MATERIAL_BASE}/angular.svg`,
    'apache': `${DEVICON_BASE}/apache/apache-original.svg`,
    'apex': `${MATERIAL_BASE}/apex.svg`,
    'apl': `${MATERIAL_BASE}/apl.svg`,
    'applescript': `${MATERIAL_BASE}/applescript.svg`,
    'asciidoc': `${MATERIAL_BASE}/asciidoc.svg`,
    'asm': `${MATERIAL_BASE}/assembly.svg`,
    'awk': `${MATERIAL_BASE}/awk.svg`,
    'ballerina': `${MATERIAL_BASE}/ballerina.svg`,
    'beancount': `${MATERIAL_BASE}/beancount.svg`,
    'bicep': `${MATERIAL_BASE}/bicep.svg`,
    'blade': `${MATERIAL_BASE}/blade.svg`,
    'c-enterprise': `${MATERIAL_BASE}/1c.svg`,
    'clojure': `${DEVICON_BASE}/clojure/clojure-original.svg`,
    'cobol': `${MATERIAL_BASE}/cobol.svg`,
    'csv': `${MATERIAL_BASE}/csv.svg`,
    'd': `${MATERIAL_BASE}/d.svg`,
    'dart': `${DEVICON_BASE}/dart/dart-original.svg`,
    'diff': `${MATERIAL_BASE}/diff.svg`,
    'dockerfile': `${DEVICON_BASE}/docker/docker-original.svg`,
    'elixir': `${DEVICON_BASE}/elixir/elixir-original.svg`,
    'elm': `${MATERIAL_BASE}/elm.svg`,
    'erlang': `${DEVICON_BASE}/erlang/erlang-original.svg`,
    'fsharp': `${DEVICON_BASE}/fsharp/fsharp-original.svg`,
    'fortran': `${DEVICON_BASE}/fortran/fortran-original.svg`,
    'graphql': `${DEVICON_BASE}/graphql/graphql-plain.svg`,
    'groovy': `${DEVICON_BASE}/groovy/groovy-original.svg`,
    'haskell': `${DEVICON_BASE}/haskell/haskell-original.svg`,
    'ini': `${MATERIAL_BASE}/settings.svg`,
    'julia': `${DEVICON_BASE}/julia/julia-original.svg`,
    'kubernetes': `${DEVICON_BASE}/kubernetes/kubernetes-plain.svg`,
    'latex': `${MATERIAL_BASE}/tex.svg`,
    'less': `${DEVICON_BASE}/less/less-plain-wordmark.svg`,
    'lua': `${DEVICON_BASE}/lua/lua-original.svg`,
    'matlab': `${DEVICON_BASE}/matlab/matlab-original.svg`,
    'nginx': `${DEVICON_BASE}/nginx/nginx-original.svg`,
    'objective-c': `${DEVICON_BASE}/objectivec/objectivec-plain.svg`,
    'ocaml': `${DEVICON_BASE}/ocaml/ocaml-original.svg`,
    'perl': `${DEVICON_BASE}/perl/perl-original.svg`,
    'powershell': `${DEVICON_BASE}/powershell/powershell-original.svg`,
    'r': `${DEVICON_BASE}/r/r-original.svg`,
    'scala': `${DEVICON_BASE}/scala/scala-original.svg`,
    'scss': `${DEVICON_BASE}/sass/sass-original.svg`,
    'solidity': `${DEVICON_BASE}/solidity/solidity-original.svg`,
    'svelte': `${DEVICON_BASE}/svelte/svelte-original.svg`,
    'terraform': `${DEVICON_BASE}/terraform/terraform-original.svg`,
    'toml': `${MATERIAL_BASE}/toml.svg`,
    'tsx': `${DEVICON_BASE}/react/react-original.svg`,
    'jsx': `${DEVICON_BASE}/react/react-original.svg`,
    'vim': `${DEVICON_BASE}/vim/vim-original.svg`,
    'visualbasic': `${MATERIAL_BASE}/visualstudio.svg`,
    'vue': `${DEVICON_BASE}/vuejs/vuejs-original.svg`,
    'wasm': `${DEVICON_BASE}/wasm/wasm-original.svg`,
    'xml': `${MATERIAL_BASE}/xml.svg`,
    'zig': `${DEVICON_BASE}/zig/zig-original.svg`,

    // Fallbacks for specific requested languages that lack dedicated icons
    'xsl': `${MATERIAL_BASE}/xml.svg`,
    'zenscript': `${MATERIAL_BASE}/settings.svg`,
    'wenyan': `${MATERIAL_BASE}/xml.svg`,
    'wgsl': `${MATERIAL_BASE}/settings.svg`,
    'wikitext': `${MATERIAL_BASE}/markdown.svg`,
    'wit': `${DEVICON_BASE}/wasm/wasm-original.svg`,
    'wolfram': `${MATERIAL_BASE}/mathematica.svg`,
    'vyper': `${MATERIAL_BASE}/v.svg`,
    'typst': `${MATERIAL_BASE}/tex.svg`,
    'vala': `${MATERIAL_BASE}/v.svg`,
    'verilog': `${MATERIAL_BASE}/settings.svg`,
    'vhdl': `${MATERIAL_BASE}/settings.svg`,
    'tsv': `${MATERIAL_BASE}/table.svg`,
};

// Aliases and Shiki-to-Logo Mapping
const ALIAS_MAPPING: Record<string, string> = {
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
    'mdx': 'markdown',
    'docker': 'dockerfile',
    'jsonc': 'json',
    'mysql': 'sql',
    'postgresql': 'sql',
    'sql': 'sql',
    'ps1': 'powershell',
    'gql': 'graphql',
    'kt': 'kotlin',
    'tf': 'terraform',
    'k8s': 'kubernetes',
    'coffee': 'coffeescript',
    'f#': 'fsharp',
    'fsharp': 'fsharp',
    'apacheconf': 'apache',
    'angular-typescript': 'angular-ts',
    'angular-html': 'angular-html',
    'assembly': 'asm',
    'elisp': 'emacs-lisp',
    'fortran-fixed-form': 'fortran',
    'fortran-free-form': 'fortran',
    'git-commit-message': 'git-commit',
    'git-rebase-message': 'git-rebase',
    '1c': 'c-enterprise',
    'lisp': 'common-lisp',
    'vb': 'visualbasic',
    'vbnet': 'visualbasic',
    'typescript-with-tags': 'typescript',
    'wasm-interface-types': 'wit',
    'vue-template': 'vue-html',
    'vue-html': 'vue',
    'vue-vine': 'vue'
};

export function getLanguageLogo(langId: string): { url: string; className?: string } | null {
    if (!langId) return null;
    const id = langId.toLowerCase().trim();
    const targetId = ALIAS_MAPPING[id] || id;
    
    const url = LOGO_MAPPING[targetId];
    if (url) {
        let className = "";
        const invertList = ['rust', 'bash', 'markdown', 'vim', 'latex', 'tex', 'asm', 'bash', 'shell', 'zig'];
        if (invertList.includes(targetId)) {
            className = "dark:invert dark:brightness-150";
        }
        return { url, className };
    }
    
    return null;
}