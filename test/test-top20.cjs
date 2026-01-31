const fs = require('fs');
const path = require('path');

// Load languageGuesser.ts
const tsCode = fs.readFileSync('src/components/Notes/features/Editor/utils/languageGuesser.ts', 'utf8');
const jsCode = tsCode
    .replace(/export\s+function/g, 'function')
    .replace(/:\s*string\s*\|?\s*null/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*boolean/g, '');
eval(jsCode);

// Top 20 most popular languages
const top20Languages = {
    'JavaScript': 'javascript',
    'Python': 'python',
    'Java': 'java',
    'TypeScript': 'typescript',
    'C#': 'csharp',
    'C++': 'cpp',
    'PHP': 'php',
    'C': 'c',
    'Shell': 'bash',
    'Ruby': 'ruby',
    'Go': 'go',
    'Rust': 'rust',
    'Kotlin': 'kotlin',
    'Swift': 'swift',
    'Dart': 'dart',
    'Scala': 'scala',
    'SQL': 'sql',
    'HTML': 'html',
    'CSS': 'css',
    'Markdown': 'markdown',
};

const samplesDir = '.reference/linguist/samples';

console.log('🎯 Testing Top 20 Most Popular Languages\n');
console.log('='.repeat(80) + '\n');

let totalTests = 0;
let passed = 0;
let failed = 0;
const results = {};

Object.keys(top20Languages).forEach((langDir, index) => {
    const expectedLang = top20Languages[langDir];
    const langPath = path.join(samplesDir, langDir);
    
    if (!fs.existsSync(langPath)) {
        console.log(`⚠️  ${langDir} - Directory not found`);
        return;
    }

    let files;
    try {
        files = fs.readdirSync(langPath, { withFileTypes: true })
            .filter(dirent => dirent.isFile())
            .map(dirent => dirent.name)
            .filter(name => !name.startsWith('.'))
            .slice(0, 5);
    } catch (err) {
        return;
    }

    if (files.length === 0) return;

    results[langDir] = { passed: 0, failed: 0, total: 0, failures: [] };

    files.forEach(file => {
        const filePath = path.join(langPath, file);
        let code;
        
        try {
            code = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            return;
        }

        if (!code || code.length === 0 || code.length > 100000) return;

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
                preview: code.substring(0, 150).replace(/\n/g, ' ')
            });
        }
    });
});

// Output results
console.log('📊 Results:\n');

Object.keys(top20Languages).forEach((lang, index) => {
    const result = results[lang];
    if (!result || result.total === 0) return;

    const passRate = ((result.passed / result.total) * 100).toFixed(1);
    const status = passRate >= 85 ? '✅' : passRate >= 60 ? '⚠️' : '❌';
    
    console.log(`${status} ${(index + 1).toString().padStart(2)}. ${lang.padEnd(20)} ${result.passed}/${result.total} (${passRate}%)`);
    
    if (result.failures.length > 0) {
        result.failures.forEach(f => {
            console.log(`      ❌ ${f.file.padEnd(30)} Expected: ${f.expected.padEnd(12)} Got: ${f.detected}`);
        });
    }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📈 Overall: ${passed}/${totalTests} passed (${((passed / totalTests) * 100).toFixed(2)}%)`);
console.log(`🎯 Target: 85% pass rate for each language\n`);

// Summary
const languagesAbove85 = Object.keys(results).filter(lang => 
    (results[lang].passed / results[lang].total) >= 0.85
).length;

const languagesBelow85 = Object.keys(results).filter(lang => 
    (results[lang].passed / results[lang].total) < 0.85
).length;

console.log(`✅ Languages at or above 85%: ${languagesAbove85}`);
console.log(`❌ Languages below 85%: ${languagesBelow85}`);

if (languagesBelow85 > 0) {
    console.log('\n⚠️  Languages needing optimization:\n');
    Object.keys(results).forEach(lang => {
        const result = results[lang];
        const passRate = (result.passed / result.total) * 100;
        if (passRate < 85) {
            console.log(`   ${lang.padEnd(20)} ${passRate.toFixed(1)}%`);
        }
    });
}
