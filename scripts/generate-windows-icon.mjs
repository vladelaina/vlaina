import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourcePngPath = path.join(projectRoot, 'public', 'logo.png');
const buildDir = path.join(projectRoot, 'build');
const targetPngPath = path.join(buildDir, 'icon.png');
const targetIcoPath = path.join(buildDir, 'icon.ico');
const targetIcnsPath = path.join(buildDir, 'icon.icns');

function runMagick(args) {
  execFileSync('magick', args, { stdio: 'pipe' });
}

function createWindowsIcon(sourcePath, targetPath) {
  // Build a real multi-resolution ICO so Windows can pick the right size
  // instead of scaling a single embedded PNG at runtime.
  runMagick([
    sourcePath,
    '-background',
    'none',
    '-define',
    'icon:auto-resize=256,128,64,48,32,16',
    targetPath,
  ]);
}

function createIcnsFromPng(pngBytes) {
  const chunkLength = 8 + pngBytes.length;
  const totalLength = 8 + chunkLength;
  const output = Buffer.alloc(totalLength);

  output.write('icns', 0, 'ascii');
  output.writeUInt32BE(totalLength, 4);
  // 1024x1024 PNG payload chunk
  output.write('ic10', 8, 'ascii');
  output.writeUInt32BE(chunkLength, 12);
  pngBytes.copy(output, 16);

  return output;
}

async function main() {
  const pngBytes = await readFile(sourcePngPath);
  await mkdir(buildDir, { recursive: true });
  await writeFile(targetPngPath, pngBytes);
  createWindowsIcon(sourcePngPath, targetIcoPath);
  await writeFile(targetIcnsPath, createIcnsFromPng(pngBytes));
  console.log(
    `Generated ${path.relative(projectRoot, targetPngPath)}, ${path.relative(projectRoot, targetIcoPath)}, and ${path.relative(projectRoot, targetIcnsPath)} from ${path.relative(projectRoot, sourcePngPath)}`,
  );
}

await main();
