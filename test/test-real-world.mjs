import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let guessLanguage;

try {
  const module = await import('../src/components/Notes/features/Editor/utils/languageDetection/index.ts');
  guessLanguage = module.guessLanguage;
  console.log('✅ 成功加载语言检测器\n');
} catch (error) {
  console.error('❌ 加载语言检测器失败');
  console.error('   错误:', error.message);
  process.exit(1);
}

const content = readFileSync(join(__dirname, 'real-world-test.md'), 'utf-8');

const testCases = [];
const lines = content.split('\n');
let currentLang = null;
let currentTestName = null;
let currentCode = [];
let inCodeBlock = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('### ')) {
    currentTestName = line.substring(4).trim();
  } else if (line.startsWith('```')) {
    if (!inCodeBlock) {
      inCodeBlock = true;
      currentCode = [];
      const lang = line.substring(3).trim();
      if (lang) {
        currentLang = lang;
      }
    } else {
      inCodeBlock = false;
      if (currentLang && currentCode.length > 0 && currentTestName) {
        testCases.push({
          expected: currentLang,
          code: currentCode.join('\n'),
          name: currentTestName
        });
      }
    }
  } else if (inCodeBlock) {
    currentCode.push(line);
  }
}

console.log(`测试 ${testCases.length} 个真实代码样本...\n`);

let passed = 0;
let failed = 0;
const failures = [];
const languageStats = {};

const langMap = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash',
  'bash': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'hbs': 'handlebars',
  'md': 'markdown',
  'viml': 'vim',
  'vim': 'vim',
  'hcl': 'terraform',
  'proto': 'protobuf',
  'proto3': 'protobuf',
  'scss': 'sass',
};

function normalizeLanguage(lang) {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  return langMap[lower] || lower;
}

for (const testCase of testCases) {
  const detected = guessLanguage(testCase.code);
  const expectedNormalized = normalizeLanguage(testCase.expected);
  const detectedNormalized = normalizeLanguage(detected);
  
  if (!languageStats[expectedNormalized]) {
    languageStats[expectedNormalized] = { total: 0, passed: 0, failed: 0 };
  }
  languageStats[expectedNormalized].total++;
  
  const isMatch = detectedNormalized === expectedNormalized;
  
  if (isMatch) {
    passed++;
    languageStats[expectedNormalized].passed++;
    console.log(`✅ ${testCase.name.padEnd(50)} → ${detected || 'null'}`);
  } else {
    failed++;
    languageStats[expectedNormalized].failed++;
    failures.push({
      expected: testCase.expected,
      detected: detected || 'null',
      code: testCase.code,
      name: testCase.name
    });
    console.log(`❌ ${testCase.name.padEnd(50)} → ${detected || 'null'} (期望: ${testCase.expected})`);
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败 (总计 ${testCases.length})`);
console.log(`成功率: ${((passed / testCases.length) * 100).toFixed(1)}%`);

console.log(`\n${'='.repeat(80)}`);
console.log('语言统计:\n');

const sortedLangs = Object.keys(languageStats).sort();
for (const lang of sortedLangs) {
  const stats = languageStats[lang];
  const rate = ((stats.passed / stats.total) * 100).toFixed(0);
  const status = stats.failed === 0 ? '✅' : '⚠️';
  console.log(`${status} ${lang.padEnd(20)} ${stats.passed}/${stats.total} (${rate}%)`);
}

if (failures.length > 0) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('失败的测试:\n');
  
  for (const failure of failures) {
    console.log(`测试: ${failure.name}`);
    console.log(`期望: ${failure.expected}`);
    console.log(`检测: ${failure.detected}`);
    console.log(`代码预览: ${failure.code.substring(0, 100).replace(/\n/g, ' ')}${failure.code.length > 100 ? '...' : ''}`);
    console.log('');
  }
}
