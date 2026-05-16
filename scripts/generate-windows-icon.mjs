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

function runImageMagick(args) {
  const missingCommandErrors = [];
  const commands = process.platform === 'win32' ? ['magick'] : ['magick', 'convert'];

  for (const command of commands) {
    try {
      execFileSync(command, args, { stdio: 'pipe' });
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }

      missingCommandErrors.push(error);
    }
  }

  throw missingCommandErrors[0];
}

async function writePngBackedIco(pngBytes, targetPath) {
  const headerSize = 6;
  const directorySize = 16;
  const imageOffset = headerSize + directorySize;
  const output = Buffer.alloc(imageOffset + pngBytes.length);

  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(1, 4);
  // ICO stores 256 as 0 in the single-byte width/height fields.
  output[6] = 0;
  output[7] = 0;
  output[8] = 0;
  output[9] = 0;
  output.writeUInt16LE(1, 10);
  output.writeUInt16LE(32, 12);
  output.writeUInt32LE(pngBytes.length, 14);
  output.writeUInt32LE(imageOffset, 18);
  pngBytes.copy(output, imageOffset);

  await writeFile(targetPath, output);
}

async function createWindowsIcon(sourcePath, targetPath, pngBytes) {
  // Build a real multi-resolution ICO so Windows can pick the right size
  // instead of scaling a single embedded PNG at runtime.
  try {
    runImageMagick([
      sourcePath,
      '-background',
      'none',
      '-define',
      'icon:auto-resize=256,128,64,48,32,16',
      targetPath,
    ]);
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'EPERM') {
      throw error;
    }

    await writePngBackedIco(pngBytes, targetPath);
    console.warn('ImageMagick was unavailable; generated build/icon.ico from the source PNG instead.');
  }
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
  await createWindowsIcon(sourcePngPath, targetIcoPath, pngBytes);
  await writeFile(targetIcnsPath, createIcnsFromPng(pngBytes));
  console.log(
    `Generated ${path.relative(projectRoot, targetPngPath)}, ${path.relative(projectRoot, targetIcoPath)}, and ${path.relative(projectRoot, targetIcnsPath)} from ${path.relative(projectRoot, sourcePngPath)}`,
  );
}

await main();
