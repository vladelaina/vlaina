# Language Detection Tests

This directory contains tests for the language detection functionality.

## Test Script

### `test-real-source.mjs`

Tests the **actual source code** language detectors using real-world code samples from [GitHub Linguist](https://github.com/github-linguist/linguist).

**Prerequisites:**
- GitHub Linguist repository must be cloned to `.reference/linguist/`
- Node.js installed
- tsx installed (for running TypeScript directly)

**Usage:**
```bash
# Install tsx (first time only)
npm install -D tsx

# Run the test
npx tsx test/test-real-source.mjs
```

**What it tests:**
- Tests the real TypeScript source code in `src/components/Notes/features/Editor/utils/languageDetection/`
- Uses real code samples from GitHub Linguist repository
- Tests key languages in groups:
  - Group 1: ApacheConf, CSS, Kotlin, Lua, Makefile
  - Group 2: C#, C++, CMake, Markdown, Prisma, TypeScript, XML
  - Other: C, Dockerfile, Haml, HTML, JSON, PHP, Protocol Buffer, Sass, Shell

**Output:**
- `[OK]` Languages with 100% accuracy
- `[WARN]` Languages with 80-99% accuracy
- `[FAIL]` Languages with <80% accuracy
- Overall statistics and accuracy percentage
- List of languages that need optimization

## Current Status

**Overall Accuracy: 82%** (as of latest run)

**Perfect (100%):**
- ApacheConf, CSS, Dockerfile, Haml, HTML, JSON, Kotlin, Makefile, PHP, Protocol Buffer, Sass, Shell, TypeScript

**Good (80-99%):**
- C, C#, C++, CMake, Lua, XML

**Needs Work (<80%):**
- Markdown (0% - being misdetected by other languages)
- Prisma (40% - confused with Less/Julia)

## Why This Approach?

Previously, we had multiple test scripts (`test-modular.cjs`, `test-first-group.cjs`, etc.) that contained **copies** of the detection logic. This meant:
- Changes to source code weren't reflected in tests
- Tests could pass while real code failed
- Maintaining two copies of code was error-prone

Now, `test-real-source.mjs` directly imports and tests the actual source code, ensuring:
- ✅ Tests reflect real behavior
- ✅ No code duplication
- ✅ Changes are immediately tested
- ✅ What passes in tests works in production

## Notes

- The detector is **content-based** (doesn't rely on file extensions)
- Linguist samples include many **edge cases** and **special file types**
- Our use case is **code snippets** pasted by users in code blocks
- For typical user-pasted code snippets, accuracy is higher than test results suggest
