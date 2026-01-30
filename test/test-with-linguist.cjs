const fs = require('fs');
const path = require('path');

// Load languageGuesser.ts file
const tsCode = fs.readFileSync('src/components/Notes/features/Editor/utils/languageGuesser.ts', 'utf8');

// Simple TypeScript to JavaScript conversion
const jsCode = tsCode
    .replace(/export\s+function/g, 'function')
    .replace(/:\s*string\s*\|?\s*null/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*boolean/g, '');

// Execute code to get guessLanguage function
eval(jsCode);

// Language mapping - Linguist directory name -> detector return value
const languageMap = {
    'JavaScript': 'javascript',
    'TypeScript': 'typescript',
    'Python': 'python',
    'Java': 'java',
    'C': 'c',
    'C++': 'cpp',
    'C#': 'csharp',
    'Ruby': 'ruby',
    'Go': 'go',
    'Rust': 'rust',
    'PHP': 'php',
    'Swift': 'swift',
    'Kotlin': 'kotlin',
    'Scala': 'scala',
    'Dart': 'dart',
    'Lua': 'lua',
    'Perl': 'perl',
    'R': 'r',
    'Shell': 'bash',
    'PowerShell': 'powershell',
    'Batchfile': 'batch',
    'SQL': 'sql',
    'HTML': 'html',
    'CSS': 'css',
    'SCSS': 'scss',
    'Less': 'less',
    'Sass': 'sass',
    'JSON': 'json',
    'YAML': 'yaml',
    'TOML': 'toml',
    'XML': 'xml',
    'Markdown': 'markdown',
    'Dockerfile': 'docker',
    'Makefile': 'makefile',
    'CMake': 'cmake',
    'Groovy': 'groovy',
    'Elixir': 'elixir',
    'Erlang': 'erlang',
    'Haskell': 'haskell',
    'Clojure': 'clojure',
    'Objective-C': 'objective-c',
    'Vim Script': 'viml',
    'Emacs Lisp': 'lisp',
    'Common Lisp': 'lisp',
    'Scheme': 'scheme',
    'Racket': 'racket',
    'Julia': 'julia',
    'MATLAB': 'matlab',
    'Fortran': 'fortran',
    'COBOL': 'cobol',
    'Assembly': 'asm',
    'GLSL': 'glsl',
    'HLSL': 'hlsl',
    'Verilog': 'verilog',
    'VHDL': 'vhdl',
    'Solidity': 'solidity',
    'Vyper': 'vyper',
    'GraphQL': 'graphql',
    'Protocol Buffer': 'proto',
    'Thrift': 'thrift',
    'Prisma': 'prisma',
    'Terraform': 'terraform',
    'Nginx': 'nginx',
    'Vue': 'vue',
    'Svelte': 'svelte',
    'Astro': 'astro',
    'JSX': 'jsx',
    'TSX': 'tsx',
    'CoffeeScript': 'coffee',
    'Pug': 'pug',
    'Handlebars': 'handlebars',
    'EJS': 'ejs',
    'Twig': 'twig',
    'Jinja': 'jinja',
    'Liquid': 'liquid',
    'HAML': 'haml',
    'Slim': 'slim',
    'LaTeX': 'latex',
    'Zig': 'zig',
    'Nim': 'nim',
    'Crystal': 'crystal',
    'D': 'd',
    'Odin': 'odin',
    'V': 'v',
    'Raku': 'raku',
    'Ada': 'ada',
    'Pascal': 'pascal',
    'Apex': 'apex',
    'Ballerina': 'ballerina',
    'CUDA': 'cuda',
};

const samplesDir = '.reference/linguist/samples';

console.log('🔍 Testing Language Detector with GitHub Linguist Samples\n');
console.log('='.repeat(80) + '\n');

let totalTests = 0;
let passed = 0;
let failed = 0;
let skipped = 0;
const results = {};

// Get all language directories
const languageDirs = fs.readdirSync(samplesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => languageMap[name]) // Only test supported languages
    .sort();

console.log(`Found ${languageDirs.length} supported language directories\n`);

// Test each language
languageDirs.forEach(langDir => {
    const expectedLang = languageMap[langDir];
    const langPath = path.join(samplesDir, langDir);
    
    // Get all sample files for this language
    let files;
    try {
        files = fs.readdirSync(langPath, { withFileTypes: true })
            .filter(dirent => dirent.isFile())
            .map(dirent => dirent.name)
            .filter(name => !name.startsWith('.')) // Ignore hidden files
            .slice(0, 5); // Test max 5 files per language
    } catch (err) {
        return;
    }

    if (files.length === 0) return;

    if (!results[langDir]) {
        results[langDir] = { passed: 0, failed: 0, total: 0, failures: [] };
    }

    files.forEach(file => {
        const filePath = path.join(langPath, file);
        let code;
        
        try {
            code = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            skipped++;
            return;
        }

        // Skip empty or too large files
        if (!code || code.length === 0 || code.length > 100000) {
            skipped++;
            return;
        }

        totalTests++;
        results[langDir].total++;

        const detected = guessLanguage(code);
        
        if (detected === expectedLang) {
            passed++;
            results[langDir].passed++;
        } else {
            failed++;
            results[langDir].failed++;
            results[langDir].failures.push({
                file,
                expected: expectedLang,
                detected: detected || 'null',
                preview: code.substring(0, 100).replace(/\n/g, ' ')
            });
        }
    });
});

// Output results
console.log('📊 Test Results by Language:\n');
console.log('='.repeat(80) + '\n');

Object.keys(results).sort().forEach(lang => {
    const result = results[lang];
    if (result.total === 0) return;

    const passRate = ((result.passed / result.total) * 100).toFixed(1);
    const status = result.failed === 0 ? '✅' : '⚠️';
    
    console.log(`${status} ${lang.padEnd(25)} ${result.passed}/${result.total} passed (${passRate}%)`);
    
    if (result.failures.length > 0 && result.failures.length <= 3) {
        result.failures.forEach(f => {
            console.log(`   ❌ ${f.file}`);
            console.log(`      Expected: ${f.expected}, Detected: ${f.detected}`);
        });
    }
});

console.log('\n' + '='.repeat(80));
console.log('\n📈 Overall Statistics:\n');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⏭️  Skipped: ${skipped}`);
console.log(`📊 Total: ${totalTests} tests`);
console.log(`🎯 Pass Rate: ${((passed / totalTests) * 100).toFixed(2)}%`);

// Find most problematic languages
console.log('\n' + '='.repeat(80));
console.log('\n⚠️  Languages Needing Improvement (fail rate > 20%):\n');

const problematicLangs = Object.keys(results)
    .map(lang => ({
        lang,
        ...results[lang],
        failRate: (results[lang].failed / results[lang].total) * 100
    }))
    .filter(r => r.failRate > 20 && r.total > 0)
    .sort((a, b) => b.failRate - a.failRate);

if (problematicLangs.length > 0) {
    problematicLangs.forEach(r => {
        console.log(`❌ ${r.lang.padEnd(25)} Fail rate: ${r.failRate.toFixed(1)}% (${r.failed}/${r.total})`);
        
        // Show first 2 failure cases
        r.failures.slice(0, 2).forEach(f => {
            console.log(`   File: ${f.file}`);
            console.log(`   Expected: ${f.expected}, Detected: ${f.detected}`);
            console.log(`   Preview: ${f.preview.substring(0, 80)}...`);
        });
        console.log('');
    });
} else {
    console.log('🎉 Excellent! All languages have high accuracy!');
}

console.log('='.repeat(80));

if (failed > 0) {
    console.log('\n💡 Suggestion: Review failed test cases and optimize detection logic in languageGuesser.ts');
} else {
    console.log('\n🎉 Perfect! All tests passed!');
}
