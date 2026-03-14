import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(packageDir, 'src');
const libDir = path.join(packageDir, 'lib');

const importRewrites = new Map([
  [
    '../../../../../prose/src/style/prosemirror.css',
    '@milkdown/prose/view/style/prosemirror.css',
  ],
  [
    '../../../../../prose/src/style/tables.css',
    '@milkdown/prose/tables/style/tables.css',
  ],
  [
    '../../../../../prose/src/style/gapcursor.css',
    '@milkdown/prose/gapcursor/style/gapcursor.css',
  ],
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildCss(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      buildCss(entryPath);
      continue;
    }

    if (!entry.name.endsWith('.css')) continue;

    const relativePath = path.relative(srcDir, entryPath);
    const outputPath = path.join(libDir, relativePath);
    let content = fs.readFileSync(entryPath, 'utf8');

    for (const [from, to] of importRewrites) {
      content = content.replaceAll(from, to);
    }

    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, content);
  }
}

buildCss(srcDir);
