import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function createIcoFromPng(pngBytes) {
  const headerSize = 6;
  const entrySize = 16;
  const imageOffset = headerSize + entrySize;
  const output = Buffer.alloc(imageOffset + pngBytes.length);

  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(1, 4);

  // Width/height of 0 in ICO means 256.
  output.writeUInt8(0, 6);
  output.writeUInt8(0, 7);
  output.writeUInt8(0, 8);
  output.writeUInt8(0, 9);
  output.writeUInt16LE(1, 10);
  output.writeUInt16LE(32, 12);
  output.writeUInt32LE(pngBytes.length, 14);
  output.writeUInt32LE(imageOffset, 18);

  pngBytes.copy(output, imageOffset);
  return output;
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
  await writeFile(targetIcoPath, createIcoFromPng(pngBytes));
  await writeFile(targetIcnsPath, createIcnsFromPng(pngBytes));
  console.log(
    `Generated ${path.relative(projectRoot, targetPngPath)}, ${path.relative(projectRoot, targetIcoPath)}, and ${path.relative(projectRoot, targetIcnsPath)} from ${path.relative(projectRoot, sourcePngPath)}`,
  );
}

await main();
