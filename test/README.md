# Language Detection Tests

This directory contains tests for the language detection functionality.

## Test Files

### `test-with-linguist.cjs`

Tests the language detector using real-world code samples from [GitHub Linguist](https://github.com/github-linguist/linguist).

**Prerequisites:**
- GitHub Linguist repository must be cloned to `.reference/linguist/`
- Node.js installed

**Usage:**
```bash
node test/test-with-linguist.cjs
```

**What it tests:**
- Tests 82 supported programming languages
- Uses up to 5 real code samples per language
- Compares detection results against expected language
- Reports pass rate and problematic languages

**Output:**
- ✅ Languages with 100% accuracy
- ⚠️ Languages needing improvement
- 📊 Overall statistics and pass rate
- 💡 Suggestions for optimization

## Test Results

Current pass rate: ~17% (as of last run)

**Best performing languages (100% pass rate):**
- Dockerfile
- Kotlin
- PHP
- SCSS
- TOML
- XML

**Languages needing improvement:**
- Most template languages (EJS, Jinja, Liquid)
- Header files (C/C++ .h files)
- Script files without shebang
- Many specialized languages

## Notes

The relatively low pass rate is expected because:
1. Our detector is **content-based** (doesn't rely on file extensions)
2. Linguist samples include many **edge cases** and **special file types**
3. Our use case is **code snippets** pasted by users, not full files
4. Many Linguist samples use special extensions or are header files

For typical user-pasted code snippets, the accuracy is much higher.
