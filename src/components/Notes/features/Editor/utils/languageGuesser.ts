export function guessLanguage(code: string): string | null {
    const text = code.trim();
    if (!text) return null;

    const maxLength = 50000;
    const sample = text.length > maxLength ? text.slice(0, maxLength) : text;
    
    const lines = sample.split('\n');
    const firstLine = lines[0] || '';
    const first100Lines = lines.slice(0, 100).join('\n');
    const isVeryShort = sample.length < 20 && lines.length === 1;
    
    const hasCurlyBraces = sample.includes('{');
    const hasArrow = sample.includes('->');
    const hasDoubleColon = sample.includes('::');
    const hasImport = sample.includes('import');
    const hasFunction = sample.includes('function');
    const hasConst = sample.includes('const');
    const hasLet = sample.includes('let');
    const hasClass = sample.includes('class');

    if (firstLine.startsWith('#!')) {
        if (firstLine.includes('/bash') || firstLine.includes('/sh')) {
            if (firstLine.includes('/fish')) return 'fish';
            if (firstLine.includes('/zsh')) return 'zsh';
            return 'bash';
        }
        if (firstLine.includes('/awk')) return 'awk';
        if (firstLine.includes('/expect')) return 'tcl';
        if (firstLine.includes('/python')) return 'python';
        if (firstLine.includes('/ruby')) return 'ruby';
        if (firstLine.includes('/node')) return 'javascript';
        if (firstLine.includes('perl')) return 'perl';
    }

    if (firstLine.startsWith('<?php') || sample.includes('<?php')) {
        return 'php';
    }

    if (firstLine.startsWith('<!DOCTYPE html>') || firstLine.startsWith('<html')) {
        return 'html';
    }

    if (firstLine.startsWith('<?xml')) {
        if (sample.includes('<project') || sample.includes('<target')) {
            return 'ant';
        }
        return 'xml';
    }

    if (firstLine.startsWith('FROM ') || /^FROM\s+[\w:.-]+/.test(firstLine)) {
        return 'docker';
    }

    if (/^(RUN|CMD|ENTRYPOINT|COPY|ADD|WORKDIR|ENV|EXPOSE)\s+/.test(firstLine)) {
        return 'docker';
    }

    if (firstLine.startsWith('# -*- coding:') || firstLine.startsWith('# coding:')) {
        return 'python';
    }

    if (/^[\w-]+:\s*$/m.test(first100Lines) || /^[\w-]+:\s+[^\{]/.test(first100Lines) && !sample.includes('<?')) {
        if (!hasCurlyBraces || lines.slice(0, 20).filter(l => l.includes(':')).length > 2) {
            if (!hasImport && !hasFunction && !hasConst && !hasLet && !hasClass) {
                return 'yaml';
            }
        }
    }

    if (/^\[[\w.-]+\]$/m.test(first100Lines) || /^[\w-]+\s*=\s*"[^"]*"$/m.test(first100Lines) || /^source\s+=|^version\s+=|^\[tool\.|^\[build-system\]/.test(first100Lines)) {
        return 'toml';
    }

    if (/^\[[\w\s]+\]$/m.test(first100Lines) && /^[\w]+\s*=\s*.+$/m.test(first100Lines)) {
        return 'ini';
    }

    if (/^[\w-]+\s*=\s*[\w-]+$|^export\s+[\w-]+=/m.test(first100Lines) && !hasCurlyBraces) {
        return 'dotenv';
    }

    if (/^task\s+\w+|^plugins\s*\{|^dependencies\s*\{|^repositories\s*\{/.test(first100Lines)) {
        return 'gradle';
    }

    if ((sample.startsWith('{') || sample.startsWith('[')) && (sample.endsWith('}') || sample.endsWith(']'))) {
        try {
            JSON.parse(sample.length > 10000 ? first100Lines : sample);
            if (sample.includes('//') || sample.includes('/*')) {
                return 'jsonc';
            }
            if (!isVeryShort && !hasFunction && !hasArrow && !hasConst && !hasLet) {
                return 'json';
            }
        } catch {}
    }

    if (firstLine.startsWith('<?xml') || (/<[\w:]+[^>]*>[\s\S]*<\/[\w:]+>/.test(first100Lines) && !/<(div|span|p|h[1-6]|a|img|script|style)/i.test(first100Lines))) {
        if (/<project|<dependencies>|<build>|<groupId>/.test(first100Lines) && sample.includes('</project>')) {
            return 'xml';
        }
        if (/<project|<target|<property/.test(first100Lines)) {
            return 'ant';
        }
        return 'xml';
    }

    if (firstLine.startsWith('<!DOCTYPE html>') || /<html[\s>]/i.test(firstLine)) {
        return 'html';
    }
    if (/<(head|body|div|span|p|h[1-6]|a|img|script|style|nav|header|footer|section|article)[^>]*>/i.test(first100Lines)) {
        if (!hasConst && !hasLet && !hasFunction && !hasImport && !sample.includes('export') && !hasClass && !hasArrow) {
            return 'html';
        }
    }

    if (/^#{1,6}\s+.+$/m.test(first100Lines) || /^\*\*[^*]+\*\*/.test(first100Lines) || /^\[.+\]\(.+\)/.test(first100Lines) || /^```/.test(first100Lines)) {
        if ((hasImport || sample.includes('export')) && /<[A-Z]\w+/.test(sample)) {
            return 'mdx';
        }
        return 'markdown';
    }

    if (/^=+\s*$/m.test(first100Lines) && /^-+\s*$/m.test(first100Lines) || /^\.\.\s+/.test(first100Lines) || /^::\s+/.test(first100Lines)) {
        return 'rst';
    }

    if (/^\*+\s+\w+|^\s*-\s+\[[ x]\]|^#\+/.test(first100Lines)) {
        return 'org';
    }

    if (/^---\n[\s\S]*?\n---/.test(first100Lines) && /^title:|^date:|^tags:/.test(first100Lines)) {
        return 'markdown';
    }

    if (/[.#][\w-]+\s*\{[^}]*\}/.test(first100Lines) || /@(media|keyframes|import|font-face)/.test(first100Lines)) {
        if (/@(apply|screen|layer|tailwind)/.test(first100Lines)) return 'postcss';
        if (sample.includes('$') && /\$[\w-]+\s*:/.test(first100Lines) && (/@(mixin|include|extend|use|forward)/.test(first100Lines) || /\$[\w-]+\s*:/.test(first100Lines))) return 'scss';
        if (sample.includes('@') && /@[\w-]+\s*:/.test(first100Lines) && sample.includes('&')) return 'less';
        if (/^[\w-]+\n\s+[\w-]+:/.test(first100Lines) && !hasCurlyBraces) return 'stylus';
        return 'css';
    }

    if (sample.includes('<?php') || sample.includes('<?=')) {
        return 'php';
    }
    if (/\$[\w]+\s*=/.test(first100Lines) && /\b(echo|print|function|class|namespace|use|require|include)\b/.test(first100Lines)) {
        if (!hasConst && !hasLet) {
            return 'php';
        }
    }

    if (/\b(fn\s+\w+|let\s+mut|impl\s+\w+|struct\s+\w+|enum\s+\w+|pub\s+fn|use\s+std::)\b/.test(first100Lines)) {
        if (hasDoubleColon || hasArrow || /\|[\w,\s]+\|/.test(first100Lines) || sample.includes('&str') || sample.includes('&mut') || /\bSome\(|\bNone\b|\bOk\(|\bErr\(/.test(first100Lines)) {
            return 'rust';
        }
        if (/\bfn\s+main\s*\(/.test(first100Lines) && sample.includes('println!')) {
            return 'rust';
        }
        if (/\b(let\s+mut|impl\s+|pub\s+fn|use\s+std::)\b/.test(first100Lines)) {
            return 'rust';
        }
    }

    if (/^package\s+\w+/m.test(first100Lines) && /\bfunc\s+/.test(first100Lines)) {
        return 'go';
    }
    if (/\bfunc\s+\w+\s*\([^)]*\)/.test(first100Lines) && (/\b(chan|go\s+func|defer|interface\s*\{|make\(|range\s+)\b/.test(first100Lines) || sample.includes(':='))) {
        return 'go';
    }

    if (/\b(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|if\s+.*:|elif\s+.*:|else:|print\(|lambda\s+|with\s+.*:|async\s+def|@\w+\s*\n\s*def)\b/.test(first100Lines)) {
        if (!hasCurlyBraces) {
            return 'python';
        }
        if (lines.slice(0, 20).filter(l => /^\s{4}|\t/.test(l)).length > 1) {
            return 'python';
        }
        if (/\b(self|__init__|__name__|__main__)\b/.test(first100Lines)) {
            return 'python';
        }
    }

    if (/\b(def\s+\w+|end\b|require\s+['"]|class\s+\w+|module\s+\w+|puts\s+|attr_accessor|\.each\s+do|\.map\s+do)\b/.test(first100Lines)) {
        if (!hasCurlyBraces || /\bdo\b|\bend\b/.test(first100Lines)) {
            if (!hasImport && !sample.includes('from ')) {
                return 'ruby';
            }
        }
    }

    if (/\b(public\s+(static\s+)?class|public\s+static\s+void\s+main|System\.out\.|private\s+(static\s+)?\w+\s+\w+;|@Override|extends\s+\w+|implements\s+\w+)\b/.test(first100Lines)) {
        if (!sample.includes('using System') && !sample.includes('Console.WriteLine')) {
            return 'java';
        }
    }

    if (/\b(using\s+System|namespace\s+\w+|Console\.(WriteLine|Write)|public\s+class\s+\w+|var\s+\w+\s*=\s*new\s+\w+)\b/.test(first100Lines)) {
        if (sample.includes('using System') || sample.includes('Console.')) {
            return 'csharp';
        }
    }

    if (/#include\s*[<"]/.test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof|NULL)\b/.test(first100Lines)) {
        if (/\b(std::|cout|cin|vector|string|template|class|namespace|new\s+\w+|delete\s+\w+)\b/.test(first100Lines)) {
            return 'cpp';
        }
        if (/\b(printf|scanf|struct\s+\w+|typedef)\b/.test(first100Lines) && !hasDoubleColon) {
            return 'c';
        }
        return 'c';
    }

    if (/\b(import\s+SwiftUI|import\s+UIKit|import\s+Foundation|var\s+body:\s*some\s+View|@State|@Binding|@Published)\b/.test(first100Lines)) {
        return 'swift';
    }
    if (/\bfunc\s+\w+/.test(first100Lines) && /\b(let|var)\s+\w+/.test(first100Lines) && !sample.includes('fun ')) {
        if (hasArrow || /@\w+/.test(first100Lines) && !sample.includes('@Override')) {
            return 'swift';
        }
    }

    if (/\b(fun\s+(main|[a-z]\w*)|val\s+\w+|var\s+\w+|data\s+class|suspend\s+fun|companion\s+object|when\s*\{)\b/.test(first100Lines)) {
        if (sample.includes('fun ') || sample.includes('data class') || sample.includes('companion object')) {
            return 'kotlin';
        }
    }

    if (/\b(void\s+main|import\s+'package:|Widget\s+build|class\s+\w+\s+extends\s+StatelessWidget)\b/.test(first100Lines)) {
        return 'dart';
    }

    if (/\b(object\s+\w+|def\s+\w+|val\s+\w+|var\s+\w+|extends\s+App|case\s+class)\b/.test(first100Lines) && sample.includes(':')) {
        return 'scala';
    }

    if (/^\w+\s*::\s*\w+/.test(first100Lines) || /\b(module|import|where|data|type|class|instance|do)\b/.test(first100Lines) && hasArrow) {
        return 'haskell';
    }

    if (/\b(defmodule|defmacro|defp|def\s+\w+|do\b|end\b|@spec|@doc|@moduledoc)\b/.test(first100Lines) && /\|>/.test(first100Lines)) {
        return 'elixir';
    }

    if (/^-module\(/.test(firstLine) || /^-export\(/.test(firstLine) || /\b(fun\s*\(|receive|spawn)\b/.test(first100Lines)) {
        return 'erlang';
    }

    if (/\b(function|local|end|then|elseif|require)\b/.test(first100Lines) && !hasCurlyBraces) {
        return 'lua';
    }

    if (/<-/.test(first100Lines) || /\b(library\(|function\(|data\.frame|ggplot|summary\()\b/.test(first100Lines)) {
        return 'r';
    }

    if (/\b(function|end|using|module|struct|macro|@)\b/.test(first100Lines) && hasDoubleColon) {
        return 'julia';
    }

    if (firstLine.includes('perl') || /\b(use\s+strict|my\s+\$|sub\s+\w+|foreach|elsif)\b/.test(first100Lines)) {
        return 'perl';
    }

    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+(TABLE|DATABASE|INDEX)|ALTER\s+TABLE|DROP\s+(TABLE|DATABASE)|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING)\b/i.test(first100Lines)) {
        const sqlKeywords = (first100Lines.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN)\b/gi) || []).length;
        if (sqlKeywords >= 2 || /\b(SELECT|INSERT|UPDATE|DELETE)\b.*\b(FROM|INTO|SET|WHERE)\b/is.test(first100Lines)) {
            if (/\b(DECLARE|BEGIN|END|EXEC|PROCEDURE)\b/i.test(first100Lines)) {
                return 'plsql';
            }
            if (/\b(DELIMITER|TRIGGER|CURSOR)\b/i.test(first100Lines)) {
                return 'mysql';
            }
            if (/\b(RETURNING|SERIAL|ARRAY)\b/i.test(first100Lines)) {
                return 'postgresql';
            }
            return 'sql';
        }
    }

    if (/\b(MATCH|CREATE|MERGE|DELETE|RETURN|WITH|UNWIND)\b/.test(first100Lines) && /\(.*\)-\[.*\]->/.test(first100Lines)) {
        return 'cypher';
    }

    if (/\b(db\.\w+\.(find|insert|update|delete|aggregate))\b/.test(first100Lines) || /\{\s*\$\w+:/.test(first100Lines)) {
        return 'mongodb';
    }

    if (/\b(query|mutation|subscription|type|schema|fragment)\b/.test(first100Lines) && hasCurlyBraces) {
        return 'graphql';
    }

    if (/\b(pragma\s+solidity|contract\s+\w+|function\s+\w+|mapping\(|address|uint256|modifier\s+\w+|event\s+\w+)\b/.test(first100Lines)) {
        return 'solidity';
    }

    if (/\b(echo|export|source|alias)\b/.test(first100Lines) && /\b(if\s+\[|fi\b|then\b|\[\[.*\]\]|case\s+.*\s+in)\b/.test(first100Lines)) {
        if (/\b(function\s+\w+|end\b|set\s+-x)\b/.test(first100Lines) && !sample.includes('fi')) return 'fish';
        return 'bash';
    }

    if (/\b(Get-|Set-|New-|Remove-|Write-Host|\$PSVersionTable|param\()\b/.test(first100Lines)) {
        return 'powershell';
    }

    if (/@echo\s+(off|on)|^(set|if|goto|call|rem)\s+/im.test(first100Lines) || /%.+%/.test(first100Lines)) {
        return 'batch';
    }

    if (/^#!.*\/awk|^BEGIN\s*\{|^END\s*\{/.test(first100Lines)) {
        return 'awk';
    }

    if (firstLine.includes('/expect') || /\b(spawn|expect|send|interact)\b/.test(first100Lines)) {
        return 'tcl';
    }

    if (/\b(def\s+\w+|class\s+\w+|println|@Grab|pipeline\s*\{)\b/.test(first100Lines) && hasCurlyBraces) {
        if (!sample.includes('fn ') && !sample.includes('println!') && !sample.includes('let mut')) {
            return 'groovy';
        }
    }

    if (/\b(resource|provider|variable|output|module|terraform)\s+"[\w-]+"/.test(first100Lines)) {
        return 'terraform';
    }

    if (/\b(server|location|listen|proxy_pass|root|index)\b/.test(first100Lines) && hasCurlyBraces) {
        return 'nginx';
    }

    const hasJSKeywords = hasConst || hasLet || hasFunction || hasImport || sample.includes('export') || hasClass || hasArrow || /\b(console\.(log|error|warn)|async|await|return|require\()\b/.test(first100Lines);
    if (hasJSKeywords) {
        const hasTypeScript = /\b(interface|type|enum)\s+\w+/.test(first100Lines) || 
            /:\s*(string|number|boolean|any|void|unknown|never|Promise<)\b/.test(first100Lines) || 
            /<\w+>(?!\s*<)/.test(first100Lines) ||
            /\bas\s+(string|number|boolean|const|any)\b/.test(first100Lines) ||
            /\b(public|private|protected|readonly)\s+\w+/.test(first100Lines);
        
        if (hasTypeScript) {
            if (/<[A-Z]\w+/.test(first100Lines) || /<(div|span|button|input|form|img|a|p|h[1-6])\s/.test(first100Lines)) {
                return 'tsx';
            }
            return 'typescript';
        }
        
        if (/<[A-Z]\w+/.test(first100Lines) || 
            /<(div|span|button|input|form|img|a|p|h[1-6]|ul|li|table|tr|td)\s/.test(first100Lines) ||
            /className=/.test(first100Lines) ||
            /\bReact\.(Component|FC|useState|useEffect)\b/.test(first100Lines)) {
            return 'jsx';
        }
        
        if (/<template>[\s\S]*<\/template>|<script[\s\S]*>[\s\S]*<\/script>|<style[\s\S]*>[\s\S]*<\/style>/.test(sample) || /<script\s+lang="ts"|<script\s+setup/.test(sample)) {
            return 'vue';
        }
        if (/<script>[\s\S]*<\/script>[\s\S]*<style>/.test(sample) && !sample.includes('<template>')) {
            return 'svelte';
        }
        if (/^---[\s\S]*?---/.test(sample) && sample.includes('<')) {
            return 'astro';
        }
        return 'javascript';
    }

    if (/^[\w]+\s*=\s*\([^)]*\)\s*->/.test(first100Lines) || /@\w+/.test(first100Lines) && !hasFunction) {
        return 'coffee';
    }

    if (/\b(defn|defmacro|def|ns|require|import)\b/.test(first100Lines) && /^\(/.test(firstLine)) {
        return 'clojure';
    }

    if (/\$:\s+\w+|on:\w+|bind:\w+|use:\w+/.test(first100Lines) && sample.includes('<script>')) {
        return 'svelte';
    }

    if (/\b(import\s+type|satisfies|as\s+const)\b/.test(first100Lines) && !sample.includes('<')) {
        return 'typescript';
    }

    if (/\{\{[\s\S]*?\}\}/.test(first100Lines) && sample.includes('<')) {
        return 'handlebars';
    }

    if (/^[\w-]+\([\w\s,='"]*\)$/m.test(first100Lines) || /^[\w-]+\.[\w-]+$/m.test(first100Lines) || /^\s+\|/.test(first100Lines)) {
        return 'pug';
    }

    if (/\{\%[\s\S]*?\%\}/.test(first100Lines) || /\{\{[\s\S]*?\}\}/.test(first100Lines) && /\{\%\s*(if|for|block|extends)/.test(first100Lines)) {
        return 'twig';
    }

    if (/\{\%[\s\S]*?\%\}/.test(first100Lines) && /\{\%\s*(if|for|assign|include|layout)/.test(first100Lines)) {
        return 'liquid';
    }

    if (/\{\%[\s\S]*?\%\}/.test(first100Lines) && /\{\%\s*(if|for|block|extends|macro)/.test(first100Lines)) {
        return 'jinja';
    }

    if (/<%[\s\S]*?%>/.test(first100Lines) && /<%-/.test(first100Lines)) {
        return 'ejs';
    }

    if (/^%[\w-]+/.test(firstLine) || /^\.[\w-]+$/.test(firstLine) || /^#[\w-]+$/.test(firstLine)) {
        return 'haml';
    }

    if (/^(diff --git|---|\+\+\+|@@)/m.test(firstLine)) {
        return 'diff';
    }

    if (/^\[\d{4}-\d{2}-\d{2}/.test(firstLine) || /^(ERROR|WARN|INFO|DEBUG):/m.test(first100Lines)) {
        return 'log';
    }

    if (/\\(documentclass|begin\{document\}|section|usepackage)/.test(first100Lines)) {
        return 'latex';
    }

    if (/@interface|@implementation|@property|@synthesize|NSString|NSArray/.test(first100Lines)) {
        return 'objective-c';
    }

    if (/\b(let\s+rec|match\s+\w+\s+with|type\s+\w+\s+=|module\s+\w+\s+=)\b/.test(first100Lines) && hasArrow) {
        return 'ocaml';
    }

    if (/\b(let\s+\w+\s+=|match\s+\w+\s+with|type\s+\w+\s+=|module\s+\w+)\b/.test(first100Lines) && /<-/.test(first100Lines)) {
        return 'fsharp';
    }

    if (/\b(pub\s+fn|const\s+\w+:\s*\w+|var\s+\w+:\s*\w+|@import|comptime)\b/.test(first100Lines)) {
        return 'zig';
    }

    if (/\b(proc\s+\w+|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+|import\s+\w+|echo\s+)/i.test(first100Lines)) {
        return 'nim';
    }

    if (/\b(def\s+\w+|class\s+\w+|module\s+\w+|require\s+"[\w/]+"|puts\s+)/i.test(first100Lines) && /:\s*\w+/.test(first100Lines)) {
        return 'crystal';
    }

    if (/\b(function|end|fprintf|disp|plot|figure|clf)\b/.test(first100Lines) && sample.includes('%')) {
        return 'matlab';
    }

    if (/\b(PROGRAM|SUBROUTINE|FUNCTION|END|IMPLICIT|REAL|INTEGER|DO|IF\s+\(.*\)\s+THEN)\b/i.test(first100Lines)) {
        return 'fortran';
    }

    if (/\b(IDENTIFICATION\s+DIVISION|PROCEDURE\s+DIVISION|WORKING-STORAGE|DISPLAY|MOVE|PERFORM)\b/i.test(first100Lines)) {
        return 'cobol';
    }

    if (/\b(syntax\s*=\s*"proto[23]"|message\s+\w+|service\s+\w+|rpc\s+\w+)\b/.test(first100Lines)) {
        return 'proto';
    }

    if (/\b(datasource|generator|model|enum)\s+\w+\s*\{/.test(first100Lines) && /@(id|unique|default|relation)/.test(first100Lines)) {
        return 'prisma';
    }

    if (/^[\w-]+:\s*$/m.test(first100Lines) && /^\t/.test(firstLine) || /\$\([\w]+\)/.test(first100Lines)) {
        return 'makefile';
    }

    if (/\b(cmake_minimum_required|project\(|add_executable|add_library|target_link_libraries)\b/i.test(first100Lines)) {
        return 'cmake';
    }

    if (/^(set|let|function!|autocmd|nnoremap|vnoremap)\s+/.test(firstLine) || /\bvimrc\b/.test(first100Lines)) {
        return 'viml';
    }

    if (/\b(with\s+pkgs;|buildInputs|stdenv\.mkDerivation|fetchFromGitHub)\b/.test(first100Lines) && hasCurlyBraces) {
        return 'nix';
    }

    if (/\b(module\s+\w+\s+exposing|import\s+\w+|type\s+alias|type\s+\w+\s+=)\b/.test(first100Lines) && hasArrow) {
        return 'elm';
    }

    if (/\b(module\s+\w+\s+where|import\s+Prelude|data\s+\w+\s+=|type\s+\w+\s+=)\b/.test(first100Lines) && hasDoubleColon) {
        return 'purescript';
    }

    if (/\b(let\s+\w+\s+=|type\s+\w+\s+=|module\s+\w+\s+=)\b/.test(first100Lines) && /=>/.test(first100Lines) && sample.includes(';')) {
        return 'reason';
    }

    if (/^\(module/.test(firstLine) && /\(func|\(import|\(export/.test(first100Lines)) {
        return 'wasm';
    }

    if (/\b(mov|push|pop|call|ret|jmp|add|sub|mul|div|cmp|test)\b/i.test(first100Lines) && /\b(eax|ebx|ecx|edx|rax|rbx|r[0-9]+)\b/i.test(first100Lines)) {
        return 'asm';
    }

    if (/\b(void\s+main|uniform|varying|attribute|vec[234]|mat[234]|texture2D|gl_Position)\b/.test(first100Lines)) {
        return 'glsl';
    }

    if (/\b(float[1-4]|matrix|Texture2D|SamplerState|cbuffer|struct\s+\w+\s*:\s*SV_)/i.test(first100Lines)) {
        return 'hlsl';
    }

    if (/\b(__global__|__device__|__host__|__shared__|threadIdx|blockIdx|cudaMalloc)\b/.test(first100Lines)) {
        return 'cuda';
    }

    if (/\b(module|endmodule|always|assign|wire|reg|input|output|posedge|negedge)\b/.test(first100Lines)) {
        return 'verilog';
    }

    if (/\b(entity|architecture|begin|end|signal|port|process|if|then|elsif)\b/i.test(first100Lines) && /<=/.test(first100Lines)) {
        return 'vhdl';
    }

    if (/\b(trigger\s+\w+\s+on|System\.debug|SOQL|Database\.insert|@isTest)\b/.test(first100Lines)) {
        return 'apex';
    }

    if (/\b(import\s+ballerina|service\s+\w+\s+on|resource\s+function|http:Client|json\s+\w+)\b/.test(first100Lines)) {
        return 'ballerina';
    }

    if (/\b(fn\s+main|println|mut\s+\w+|struct\s+\w+|pub\s+fn)\b/.test(first100Lines) && sample.includes('?') && !hasDoubleColon) {
        return 'v';
    }

    if (/^\(define\s+\(|^\(lambda\s+\(|#lang\s+racket/.test(firstLine)) {
        return 'racket';
    }

    if (/^\(define\s+\w+|^\(lambda\s+\(|^\(car\s+|^\(cdr\s+/.test(firstLine) && !sample.includes('#lang')) {
        return 'scheme';
    }

    if (/^\(defun\s+\w+|^\(defvar\s+\w+|^\(setq\s+\w+|^\(format\s+t/.test(firstLine)) {
        return 'lisp';
    }

    if (/\b(Object\s+subclass:|ifTrue:|ifFalse:|do:|collect:|select:)\b/.test(first100Lines) && /\[[\s\S]*\]/.test(first100Lines)) {
        return 'smalltalk';
    }

    if (/\b(procedure|function|begin|end|with|use|package|type|is|loop)\b/i.test(first100Lines) && /:=/.test(first100Lines)) {
        return 'ada';
    }

    if (/\b(program|procedure|function|begin|end|var|type|uses)\b/i.test(first100Lines) && /:=/.test(first100Lines)) {
        return 'pascal';
    }

    if (/^BEGIN\s*\{|^END\s*\{|^\s*\{.*\}$|\/.*\//.test(first100Lines) && /\b(print|printf|NR|NF|FS|RS)\b/.test(first100Lines)) {
        return 'awk';
    }

    if (/^s\/.*\/.*\/|^\/.*\/d|^[0-9]+,[0-9]+[dps]/.test(firstLine)) {
        return 'sed';
    }

    if (/\b(proc|set|puts|if\s*\{|foreach|while\s*\{|expr)\b/.test(first100Lines) && /\$\w+/.test(first100Lines)) {
        return 'tcl';
    }

    if (/\b(REPORT|DATA:|FORM|ENDFORM|WRITE|SELECT|FROM|WHERE|LOOP|ENDLOOP)\b/i.test(first100Lines) && sample.includes('.')) {
        return 'abap';
    }

    if (/\b(package|class|function|var|const|import|public|private|override)\b/.test(first100Lines) && /:.*\b(void|int|String|Number|Boolean|Array)\b/.test(first100Lines)) {
        if (sample.includes('flash.') || sample.includes('mx.')) {
            return 'actionscript';
        }
    }

    if (/\b(resource|param|var|output|module)\s+\w+\s+=/.test(first100Lines) && sample.includes('@')) {
        return 'bicep';
    }

    if (/\b(pub\s+contract|pub\s+fun|pub\s+resource|access\(all\)|pre\s*\{|post\s*\{)\b/.test(first100Lines)) {
        return 'cadence';
    }

    if (/\b(define-public|define-private|define-constant|define-map|define-data-var)\b/.test(first100Lines) && /\(ok\s+|\(err\s+/.test(first100Lines)) {
        return 'clarity';
    }

    if (/\b(Theorem|Lemma|Definition|Proof|Qed|Inductive|Fixpoint|match\s+\w+\s+with)\b/.test(first100Lines) && hasArrow) {
        return 'coq';
    }

    if (/\b(module|import|void|int|auto|foreach|unittest|version|debug)\b/.test(first100Lines) && /\b(writeln|readln)\b/.test(first100Lines)) {
        return 'd';
    }

    if (/^\(fn\s+\[|^\(lambda\s+\[|^\(let\s+\[/.test(firstLine) && !sample.includes('#lang')) {
        return 'fennel';
    }

    if (/\b(pub\s+fn|pub\s+type|case\s+\w+\s+\{|import\s+gleam)\b/.test(first100Lines) && hasArrow) {
        return 'gleam';
    }

    if (/^set\s+(terminal|output|xlabel|ylabel|title)|^plot\s+|^splot\s+/.test(firstLine)) {
        return 'gnuplot';
    }

    if (/\b(tag|def|prop|css|attr)\b/.test(first100Lines) && /<self>/.test(first100Lines)) {
        return 'imba';
    }

    if (/\b(local|function|std\.|error|import)\b/.test(first100Lines) && hasCurlyBraces && hasDoubleColon) {
        return 'jsonnet';
    }

    if (/\b(theorem|lemma|def|axiom|inductive|structure|namespace|open)\b/.test(first100Lines) && /:=/.test(first100Lines) && hasArrow) {
        return 'lean';
    }

    if (/\b(fn|struct|var|let|def|trait|alias)\s+\w+/.test(first100Lines) && /@(parameter|value|register)/.test(first100Lines)) {
        return 'mojo';
    }

    if (/\b(module|public\s+entry\s+fun|struct|resource|acquires|move_to|borrow_global)\b/.test(first100Lines)) {
        return 'move';
    }

    if (/\b(package|import|proc|struct|union|enum|distinct|using|foreign)\b/.test(first100Lines) && hasDoubleColon && /@\(/.test(first100Lines)) {
        return 'odin';
    }

    if (/\b(my|our|sub|package|use|say|given|when)\b/.test(first100Lines) && hasArrow) {
        return 'raku';
    }

    if (/@external|@view|@pure|@payable/.test(first100Lines) && /\b(def|event|struct|interface)\b/.test(first100Lines)) {
        return 'vyper';
    }

    if (/\b(Module|BeginPackage|EndPackage|Plot|Integrate|Solve|DSolve)\b/.test(first100Lines) && /\[\[.*\]\]/.test(first100Lines)) {
        return 'wolfram';
    }

    return null;
}