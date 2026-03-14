import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(packageDir, 'src');
const libDir = path.join(packageDir, 'lib');
const themeSrcDir = path.join(srcDir, 'theme');
const themeLibDir = path.join(libDir, 'theme');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function shouldSkip(fileName) {
  return /\.(spec|test)\.[^.]+$/.test(fileName) || fileName.endsWith('.d.ts');
}

function transpileSourceTree(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(srcDir, entryPath);

    if (entry.isDirectory()) {
      transpileSourceTree(entryPath);
      continue;
    }

    if (shouldSkip(entry.name)) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const source = fs.readFileSync(entryPath, 'utf8');

    for (const [moduleKind, outRoot] of [
      [ts.ModuleKind.ESNext, path.join(libDir, 'esm')],
      [ts.ModuleKind.CommonJS, path.join(libDir, 'cjs')],
    ]) {
      const result = ts.transpileModule(source, {
        compilerOptions: {
          module: moduleKind,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.React,
          jsxFactory: 'h',
          jsxFragmentFactory: 'Fragment',
          sourceMap: true,
        },
        fileName: entryPath,
      });

      const outputFilePath = path.join(outRoot, relativePath).replace(/\.(ts|tsx)$/, '.js');
      writeFile(outputFilePath, result.outputText);
      if (result.sourceMapText) {
        writeFile(`${outputFilePath}.map`, result.sourceMapText);
      }
    }
  }
}

function copyThemeTree(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      copyThemeTree(entryPath);
      continue;
    }

    if (!entry.name.endsWith('.css')) continue;

    const relativePath = path.relative(themeSrcDir, entryPath);
    const outputPath = path.join(themeLibDir, relativePath);
    writeFile(outputPath, fs.readFileSync(entryPath, 'utf8'));
  }
}

fs.rmSync(libDir, { recursive: true, force: true });
transpileSourceTree(srcDir);
copyThemeTree(themeSrcDir);
