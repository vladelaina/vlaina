const fs = require('fs');
const path = require('path');

// Copy all detector code from test-modular.cjs
const detectorsPath = 'src/components/Notes/features/Editor/utils/languageDetection';

// ===== Common utilities =====
function createContext(code) {
  const text = code.trim();
  const maxLength = 50000;
  const sample = text.length > maxLength ? text.slice(0, maxLength) : text;
  
  const lines = sample.split('\n');
  const firstLine = lines[0] || '';
  const first20Lines = lines.slice(0, 20).join('\n');
  const first100Lines = lines.slice(0, 100).join('\n');
  
  return {
    code: text,
    sample,
    lines,
    firstLine,
    first20Lines,
    first100Lines,
    
    hasCurlyBraces: sample.includes('{'),
    hasArrow: sample.includes('->'),
    hasDoubleColon: sample.includes('::'),
    hasImport: sample.includes('import'),
    hasFunction: sample.includes('function'),
    hasConst: sample.includes('const'),
    hasLet: sample.includes('let'),
    hasClass: sample.includes('class'),
    hasSemicolon: sample.includes(';'),
  };
}

function checkShebang(ctx) {
  const { firstLine } = ctx;
  
  if (!firstLine.startsWith('#!')) return null;
  
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
  
  return null;
}

// Load all detectors from test-modular.cjs
eval(fs.readFileSync('test/test-modular.cjs', 'utf8').split('// ===== Test runner =====')[0].split('// ===== Common utilities =====')[1]);

// Test specific language
const targetLang = process.argv[2] || 'Go';
const expectedLangId = {
  'Go': 'go',
  'Rust': 'rust',
  'Java': 'java',
  'JavaScript': 'javascript',
  'TypeScript': 'typescript',
  'Ruby': 'ruby',
  'Shell': 'bash',
  'SQL': 'sql',
  'Markdown': 'markdown',
  'C#': 'csharp',
  'Kotlin': 'kotlin',
  'Swift': 'swift',
  'Dart': 'dart',
  'Scala': 'scala',
  'C++': 'cpp',
  'C': 'c',
  'HTML': 'html',
  'CSS': 'css',
  'PHP': 'php',
  'Python': 'python',
}[targetLang];

const samplesDir = '.reference/linguist/samples';
const langPath = path.join(samplesDir, targetLang);

console.log(`\n🔍 Detailed Test for ${targetLang}\n`);
console.log('='.repeat(80) + '\n');

if (!fs.existsSync(langPath)) {
  console.log(`❌ No samples found for ${targetLang}`);
  process.exit(1);
}

const files = fs.readdirSync(langPath, { withFileTypes: true })
  .filter(dirent => dirent.isFile())
  .map(dirent => dirent.name)
  .filter(name => !name.startsWith('.'))
  .slice(0, 10);

let passed = 0;
let failed = 0;

files.forEach(file => {
  const filePath = path.join(langPath, file);
  let code;
  
  try {
    code = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return;
  }

  if (!code || code.length === 0 || code.length > 200000) return;

  const detected = guessLanguage(code);
  const isCorrect = detected === expectedLangId;
  
  if (isCorrect) {
    passed++;
    console.log(`✅ ${file.padEnd(40)} ✓`);
  } else {
    failed++;
    console.log(`❌ ${file.padEnd(40)} Expected: ${expectedLangId.padEnd(12)} Got: ${detected || 'null'}`);
    
    // Show first 20 lines for debugging
    console.log(`   First 20 lines:`);
    const lines = code.split('\n').slice(0, 20);
    lines.forEach((line, i) => {
      console.log(`   ${(i+1).toString().padStart(2)}: ${line.slice(0, 80)}`);
    });
    console.log('');
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Result: ${passed}/${passed + failed} passed (${((passed / (passed + failed)) * 100).toFixed(1)}%)\n`);
