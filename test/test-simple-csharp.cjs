#!/usr/bin/env node

const code = `int Sum(int a, int b){return a + b;}`;

// Simulate detection
const hasMethodSignature = /\b(int|string|void|bool|double|float)\s+[A-Z]\w*\s*\([^)]*\)\s*\{/.test(code);
console.log('Has C# method signature:', hasMethodSignature);

const hasPackageOrImport = /^(package|import)\s+/m.test(code);
console.log('Has package/import:', hasPackageOrImport);

const hasInclude = /#include\s*[<"]/.test(code);
console.log('Has #include:', hasInclude);

const hasStd = /std::/.test(code);
console.log('Has std::', hasStd);

if (hasMethodSignature && !hasPackageOrImport && !hasInclude && !hasStd) {
  console.log('✅ Would detect as C#');
} else {
  console.log('❌ Would NOT detect as C#');
}
