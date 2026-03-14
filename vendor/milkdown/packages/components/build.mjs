import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(packageDir, 'src');
const libDir = path.join(packageDir, 'lib');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function shouldSkip(fileName) {
  return /\.(spec|test)\.[^.]+$/.test(fileName);
}

function transpileSourceTree(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(srcDir, entryPath);
    const outputBasePath = path.join(libDir, relativePath);

    if (entry.isDirectory()) {
      transpileSourceTree(entryPath);
      continue;
    }

    if (shouldSkip(entry.name)) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const source = fs.readFileSync(entryPath, 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React,
        jsxFactory: 'h',
        jsxFragmentFactory: 'Fragment',
        sourceMap: true,
      },
      fileName: entryPath,
    });

    const outputFilePath = outputBasePath.replace(/\.(ts|tsx)$/, '.js');
    writeFile(outputFilePath, result.outputText);
    if (result.sourceMapText) {
      writeFile(`${outputFilePath}.map`, result.sourceMapText);
    }
  }
}

fs.rmSync(libDir, { recursive: true, force: true });
transpileSourceTree(srcDir);
