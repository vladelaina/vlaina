#!/usr/bin/env node

/**
 * 扩展语言检测测试脚本
 * 测试每种语言的多个用例（单行和多行）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 直接从源代码导入检测器
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

// 解析测试文件
function parseTestFile(content) {
  const tests = [];
  const lines = content.split('\n');
  let currentLanguage = null;
  let currentTestName = null;
  let inCodeBlock = false;
  let codeLines = [];
  let codeLanguage = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测语言标题 (## Language)
    if (line.startsWith('## ') && !line.startsWith('###')) {
      currentLanguage = line.substring(3).trim();
      continue;
    }

    // 检测测试用例标题 (### Language - Test Name)
    if (line.startsWith('### ')) {
      currentTestName = line.substring(4).trim();
      continue;
    }

    // 检测代码块开始
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // 开始代码块
        inCodeBlock = true;
        codeLanguage = line.substring(3).trim() || currentLanguage;
        codeLines = [];
      } else {
        // 结束代码块
        inCodeBlock = false;
        if (currentLanguage && currentTestName && codeLines.length > 0) {
          tests.push({
            language: currentLanguage,
            testName: currentTestName,
            code: codeLines.join('\n'),
            expectedLanguage: codeLanguage
          });
        }
        codeLines = [];
        codeLanguage = null;
      }
      continue;
    }

    // 收集代码行
    if (inCodeBlock) {
      codeLines.push(line);
    }
  }

  return tests;
}

// 运行测试
function runTests() {
  console.log('🧪 开始扩展语言检测测试...\n');

  const testFilePath = join(__dirname, 'extended-test.md');
  const content = readFileSync(testFilePath, 'utf-8');
  const tests = parseTestFile(content);

  console.log(`📝 共找到 ${tests.length} 个测试用例\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  // 按语言分组统计
  const languageStats = {};

  for (const test of tests) {
    const detected = guessLanguage(test.code);
    
    // 如果检测失败，跳过
    if (!detected) {
      failed++;
      if (!languageStats[test.language]) {
        languageStats[test.language] = { passed: 0, failed: 0, total: 0 };
      }
      languageStats[test.language].total++;
      languageStats[test.language].failed++;
      console.log(`❌ ${test.language} - ${test.testName} (未检测到)`);
      failures.push({
        language: test.language,
        testName: test.testName,
        expected: test.expectedLanguage.toLowerCase(),
        detected: 'null',
        code: test.code
      });
      continue;
    }
    
    const expected = test.expectedLanguage.toLowerCase();
    const detectedLower = detected.toLowerCase();
    
    // 初始化语言统计
    if (!languageStats[test.language]) {
      languageStats[test.language] = { passed: 0, failed: 0, total: 0 };
    }
    languageStats[test.language].total++;

    // 检查是否匹配（考虑别名）
    const isMatch = detectedLower === expected || 
                    (expected === 'javascript' && detectedLower === 'js') ||
                    (expected === 'typescript' && detectedLower === 'ts') ||
                    (expected === 'python' && detectedLower === 'py') ||
                    (expected === 'markdown' && detectedLower === 'md') ||
                    (expected === 'yaml' && detectedLower === 'yml') ||
                    (expected === 'shell' && detectedLower === 'bash') ||
                    (expected === 'shell' && detectedLower === 'sh') ||
                    (expected === 'vim' && detectedLower === 'viml') ||
                    (expected === 'viml' && detectedLower === 'vim');

    if (isMatch) {
      passed++;
      languageStats[test.language].passed++;
      console.log(`✅ ${test.language} - ${test.testName}`);
    } else {
      failed++;
      languageStats[test.language].failed++;
      console.log(`❌ ${test.language} - ${test.testName}`);
      failures.push({
        language: test.language,
        testName: test.testName,
        expected,
        detected,
        code: test.code
      });
    }
  }

  // 打印统计信息
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果统计\n');
  
  // 按语言显示统计
  console.log('各语言测试结果:');
  const sortedLanguages = Object.keys(languageStats).sort();
  for (const lang of sortedLanguages) {
    const stats = languageStats[lang];
    const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
    const status = stats.failed === 0 ? '✅' : '⚠️';
    console.log(`  ${status} ${lang}: ${stats.passed}/${stats.total} (${percentage}%)`);
  }

  console.log('\n总体结果:');
  console.log(`  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  📈 准确率: ${((passed / tests.length) * 100).toFixed(2)}%`);

  // 显示失败的测试详情
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ 失败的测试详情:\n');
    
    for (const failure of failures) {
      console.log(`语言: ${failure.language}`);
      console.log(`测试: ${failure.testName}`);
      console.log(`期望: ${failure.expected}`);
      console.log(`检测: ${failure.detected}`);
      console.log(`代码预览: ${failure.code.substring(0, 100)}${failure.code.length > 100 ? '...' : ''}`);
      console.log('-'.repeat(60));
    }
  }

  console.log('='.repeat(60));

  // 如果有失败的测试，返回错误代码
  if (failed > 0) {
    process.exit(1);
  }
}

// 运行测试
runTests();
