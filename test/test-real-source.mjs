#!/usr/bin/env node
/**
 * 直接测试源码中的语言检测器
 * 测试所有有图标支持的语言
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 设置控制台输出为 UTF-8（Windows 兼容）
if (process.platform === 'win32') {
  try {
    process.stdout.write('\x1B[?25h'); // 显示光标
  } catch (e) {
    // 忽略错误
  }
}

console.log('\n================================================================================');
console.log('          Language Detection Test - Real Source Code');
console.log('================================================================================\n');

// 所有有图标支持的语言（按分类组织）
const testGroups = {
  'Top 20 Most Popular': {
    'JavaScript': 'javascript',
    'TypeScript': 'typescript',
    'Python': 'python',
    'Java': 'java',
    'HTML': 'html',
    'CSS': 'css',
    'C++': 'cpp',
    'C': 'c',
    'C#': 'csharp',
    'PHP': 'php',
    'Go': 'go',
    'Rust': 'rust',
    'Kotlin': 'kotlin',
    'Swift': 'swift',
    'Ruby': 'ruby',
    'SQL': 'sql',
    'Shell': 'bash',
    'PowerShell': 'powershell',
    'JSON': 'json',
    'YAML': 'yaml',
  },
  'Web & Frontend': {
    'Vue': 'vue',
    'Svelte': 'svelte',
    'MDX': 'mdx',
    'SCSS': 'scss',
    'Sass': 'sass',
    'Less': 'less',
    'Stylus': 'stylus',
    'PostCSS': 'postcss',
    'GraphQL': 'graphql',
  },
  'Backend & Systems': {
    'Scala': 'scala',
    'Dart': 'dart',
    'Elixir': 'elixir',
    'Erlang': 'erlang',
    'Haskell': 'haskell',
    'Clojure': 'clojure',
    'Lua': 'lua',
    'Perl': 'perl',
    'R': 'r',
    'Julia': 'julia',
    'MATLAB': 'matlab',
  },
  'Functional & Academic': {
    'OCaml': 'ocaml',
    'F#': 'fsharp',
    'Elm': 'elm',
  },
  'Markup & Documentation': {
    'Markdown': 'markdown',
    'XML': 'xml',
    'TOML': 'toml',
    'LaTeX': 'latex',
  },
  'DevOps & Config': {
    'Dockerfile': 'dockerfile',
    'Terraform': 'terraform',
    'Nginx': 'nginx',
    'ApacheConf': 'apache',
  },
  'Databases & Query': {
    'Prisma': 'prisma',
    'Protocol Buffer': 'protobuf',
  },
  'Templates': {
    'Jinja': 'jinja',
    'Liquid': 'liquid',
    'Handlebars': 'handlebars',
    'Pug': 'pug',
    'Twig': 'twig',
    'Haml': 'haml',
    'Astro': 'astro',
  },
  'Scripting': {
    'Groovy': 'groovy',
    'CoffeeScript': 'coffeescript',
  },
  'Game & Blockchain': {
    'GDScript': 'gdscript',
    'Solidity': 'solidity',
  },
  'Systems & Low-level': {
    'Zig': 'zig',
    'Nim': 'nim',
    'Crystal': 'crystal',
    'Objective-C': 'objective-c',
  },
  'Build & Tools': {
    'CMake': 'cmake',
    'Makefile': 'makefile',
    'Vim Script': 'viml',
  },
};

const samplesDir = path.join(__dirname, '..', '.reference', 'linguist', 'samples');

// 检查样例目录
if (!fs.existsSync(samplesDir)) {
  console.error('❌ Sample directory not found:', samplesDir);
  console.error('   Please clone linguist repository to .reference/linguist/\n');
  process.exit(1);
}

console.log('📁 Sample Directory:', samplesDir);
console.log('📦 Testing all languages with icon support\n');

// 尝试动态导入源码
let guessLanguage;
try {
  const module = await import('../src/components/Notes/features/Editor/utils/languageDetection/index.ts');
  guessLanguage = module.guessLanguage;
  console.log('✅ Successfully loaded source code detectors\n');
} catch (error) {
  console.error('❌ Failed to load source code detectors');
  console.error('   Error:', error.message);
  console.error('\n💡 Please install tsx and run:');
  console.error('   npm install -D tsx');
  console.error('   npx tsx test/test-real-source.mjs\n');
  process.exit(1);
}

console.log('=' + '='.repeat(79));
console.log('Starting Tests...');
console.log('=' + '='.repeat(79) + '\n');

// 运行测试
const results = {};
let totalTests = 0;
let totalPassed = 0;
let totalGroups = Object.keys(testGroups).length;
let currentGroup = 0;

for (const [groupName, languages] of Object.entries(testGroups)) {
  currentGroup++;
  console.log(`\n[${currentGroup}/${totalGroups}] ${groupName}`);
  console.log('-'.repeat(80));
  
  for (const [langName, expectedLang] of Object.entries(languages)) {
    const langDir = path.join(samplesDir, langName);
    
    if (!fs.existsSync(langDir)) {
      console.log(`  [SKIP] ${langName.padEnd(25)} No samples found`);
      continue;
    }
    
    const files = fs.readdirSync(langDir)
      .filter(f => {
        const stat = fs.statSync(path.join(langDir, f));
        return stat.isFile() && !f.startsWith('.') && !f.endsWith('.md');
      })
      .slice(0, 5); // 每个语言测试前 5 个文件
    
    if (files.length === 0) {
      console.log(`  [SKIP] ${langName.padEnd(25)} No valid samples`);
      continue;
    }
    
    let passed = 0;
    const failures = [];
    
    for (const file of files) {
      const filePath = path.join(langDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const detected = guessLanguage(content);
      
      totalTests++;
      
      // 检查是否匹配（支持多个可能的语言名）
      const possibleLangs = [expectedLang];
      
      // 特殊情况处理
      if (expectedLang === 'bash') possibleLangs.push('shell', 'sh', 'shellscript');
      if (expectedLang === 'csharp') possibleLangs.push('cs', 'c#');
      if (expectedLang === 'cpp') possibleLangs.push('c++', 'cxx');
      if (expectedLang === 'javascript') possibleLangs.push('js', 'typescript', 'ts');
      if (expectedLang === 'typescript') possibleLangs.push('ts', 'javascript', 'js');
      if (expectedLang === 'markdown') possibleLangs.push('md');
      if (expectedLang === 'dockerfile') possibleLangs.push('docker');
      if (expectedLang === 'makefile') possibleLangs.push('make');
      if (expectedLang === 'protobuf') possibleLangs.push('proto');
      if (expectedLang === 'viml') possibleLangs.push('vim', 'vimscript');
      if (expectedLang === 'coffeescript') possibleLangs.push('coffee');
      
      if (possibleLangs.includes(detected)) {
        passed++;
        totalPassed++;
      } else {
        failures.push({ file, detected });
      }
    }
    
    const percentage = Math.round((passed / files.length) * 100);
    let icon;
    
    if (percentage === 100) {
      icon = '[OK]  ';
    } else if (percentage >= 80) {
      icon = '[WARN]';
    } else {
      icon = '[FAIL]';
    }
    
    const stats = `${passed}/${files.length}`.padStart(5);
    const pct = `${percentage}%`.padStart(4);
    
    console.log(`  ${icon} ${langName.padEnd(25)} ${stats} ${pct}`);
    
    if (failures.length > 0 && failures.length <= 2) {
      failures.forEach(({ file, detected }) => {
        const shortFile = file.length > 30 ? file.substring(0, 27) + '...' : file;
        console.log(`         -> ${shortFile.padEnd(30)} detected as: ${detected || 'null'}`);
      });
    }
    
    results[langName] = { passed, total: files.length, percentage, failures };
  }
}

// 总结
console.log('\n' + '='.repeat(80));
console.log('Test Summary');
console.log('='.repeat(80) + '\n');

const accuracy = Math.round((totalPassed / totalTests) * 100);

console.log(`Total Tests:      ${totalTests}`);
console.log(`Passed:           ${totalPassed}`);
console.log(`Failed:           ${totalTests - totalPassed}`);
console.log(`Overall Accuracy: ${accuracy}%\n`);

// 按准确率分类
const perfect = [];
const good = [];
const needsWork = [];
const failing = [];

Object.entries(results).forEach(([lang, r]) => {
  if (r.percentage === 100) perfect.push([lang, r]);
  else if (r.percentage >= 80) good.push([lang, r]);
  else if (r.percentage >= 50) needsWork.push([lang, r]);
  else failing.push([lang, r]);
});

if (perfect.length > 0) {
  console.log(`[OK] Perfect (100%) - ${perfect.length} languages`);
  console.log('  ' + perfect.map(([lang]) => lang).join(', '));
  console.log();
}

if (good.length > 0) {
  console.log(`[WARN] Good (80-99%) - ${good.length} languages`);
  good.forEach(([lang, r]) => {
    console.log(`  * ${lang}: ${r.percentage}% (${r.passed}/${r.total})`);
  });
  console.log();
}

if (needsWork.length > 0) {
  console.log(`[FAIL] Needs Work (50-79%) - ${needsWork.length} languages`);
  needsWork.forEach(([lang, r]) => {
    console.log(`  * ${lang}: ${r.percentage}% (${r.passed}/${r.total})`);
    if (r.failures.length > 0) {
      r.failures.slice(0, 1).forEach(({ file, detected }) => {
        console.log(`    -> ${file} detected as: ${detected || 'null'}`);
      });
    }
  });
  console.log();
}

if (failing.length > 0) {
  console.log(`[FAIL] Failing (<50%) - ${failing.length} languages`);
  failing.forEach(([lang, r]) => {
    console.log(`  * ${lang}: ${r.percentage}% (${r.passed}/${r.total})`);
    if (r.failures.length > 0) {
      r.failures.slice(0, 2).forEach(({ file, detected }) => {
        console.log(`    -> ${file} detected as: ${detected || 'null'}`);
      });
    }
  });
  console.log();
}

console.log('='.repeat(80));
console.log(`\nTip: Focus on fixing the ${failing.length + needsWork.length} languages below 80%\n`);
