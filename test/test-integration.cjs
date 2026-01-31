#!/usr/bin/env node

/**
 * Integration test for language detection in the actual application
 */

const fs = require('fs');
const path = require('path');

// Read the TypeScript source files
const indexPath = path.join(__dirname, '../src/components/Notes/features/Editor/utils/languageDetection/index.ts');
const commonPath = path.join(__dirname, '../src/components/Notes/features/Editor/utils/languageDetection/common.ts');
const shikiPath = path.join(__dirname, '../src/components/Notes/features/Editor/utils/shiki.ts');

console.log('🔍 Integration Test: Language Detection Flow\n');
console.log('================================================================================\n');

// Test 1: Check if all detector return values are valid
console.log('Test 1: Checking detector return values...');
const indexContent = fs.readFileSync(indexPath, 'utf-8');
const detectorReturns = indexContent.match(/return '[a-z]+';/g) || [];
console.log('  Detector returns found:', detectorReturns.length);
console.log('  Values:', [...new Set(detectorReturns)].join(', '));

// Test 2: Check shebang mappings
console.log('\nTest 2: Checking shebang mappings...');
const commonContent = fs.readFileSync(commonPath, 'utf-8');
const shebangReturns = commonContent.match(/return '[a-z]+';/g) || [];
console.log('  Shebang returns found:', shebangReturns.length);
console.log('  Values:', [...new Set(shebangReturns)].join(', '));

// Test 3: Check if all languages are in SUPPORTED_LANGUAGES
console.log('\nTest 3: Checking SUPPORTED_LANGUAGES...');
const shikiContent = fs.readFileSync(shikiPath, 'utf-8');
const supportedLangsMatch = shikiContent.match(/id: '([a-z0-9-]+)'/g) || [];
const supportedLangs = supportedLangsMatch.map(m => m.match(/id: '([a-z0-9-]+)'/)[1]);
console.log('  Supported languages:', supportedLangs.length);

// Extract all return values from detectors
const allReturns = new Set();
const detectorFiles = fs.readdirSync(path.join(__dirname, '../src/components/Notes/features/Editor/utils/languageDetection/detectors'));
detectorFiles.forEach(file => {
  const content = fs.readFileSync(path.join(__dirname, '../src/components/Notes/features/Editor/utils/languageDetection/detectors', file), 'utf-8');
  const returns = content.match(/return '[a-z0-9]+';/g) || [];
  returns.forEach(r => {
    const lang = r.match(/return '([a-z0-9]+)';/)[1];
    allReturns.add(lang);
  });
});

// Add shebang returns
shebangReturns.forEach(r => {
  const lang = r.match(/return '([a-z0-9]+)';/)[1];
  allReturns.add(lang);
});

console.log('\n  All detector return values:', [...allReturns].sort().join(', '));

// Check if all returns are in supported languages
const unsupported = [...allReturns].filter(lang => !supportedLangs.includes(lang));
if (unsupported.length > 0) {
  console.log('\n  ❌ UNSUPPORTED LANGUAGES:', unsupported.join(', '));
  console.log('  These languages will cause normalizeLanguage to return null!');
} else {
  console.log('\n  ✅ All detector return values are supported by Shiki');
}

console.log('\n================================================================================\n');

if (unsupported.length > 0) {
  console.log('❌ Integration test FAILED: Some languages are not supported');
  process.exit(1);
} else {
  console.log('✅ Integration test PASSED: All languages are properly mapped');
  process.exit(0);
}
