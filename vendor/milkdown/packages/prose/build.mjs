import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
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

function buildSourceTree(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(srcDir, entryPath);
    const outputPath = path.join(libDir, relativePath);

    if (entry.isDirectory()) {
      buildSourceTree(entryPath);
      continue;
    }

    if (entry.name.endsWith('.ts')) {
      const source = fs.readFileSync(entryPath, 'utf8');
      const result = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
          sourceMap: true,
        },
        fileName: entryPath,
      });

      writeFile(outputPath.replace(/\.ts$/, '.js'), result.outputText);
      if (result.sourceMapText) {
        writeFile(`${outputPath.replace(/\.ts$/, '.js')}.map`, result.sourceMapText);
      }
      continue;
    }

    if (entry.name.endsWith('.css')) {
      writeFile(outputPath, fs.readFileSync(entryPath, 'utf8'));
    }
  }
}

fs.rmSync(libDir, { recursive: true, force: true });
buildSourceTree(srcDir);

const tscBin = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [tscBin, '-b', 'tsconfig.json', '--pretty', 'false'], {
  cwd: packageDir,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
