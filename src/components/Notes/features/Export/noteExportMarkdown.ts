import { getElectronBridge } from '@/lib/electron/bridge';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';

async function resolveAssetUrl(
  src: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  if (!src.startsWith('img:') || !notesPath) {
    return src;
  }

  const bridge = getElectronBridge();
  if (!bridge) {
    return src;
  }

  const assetPath = src.slice(4);
  const absolutePath = await resolveExistingVaultAssetPath(notesPath, assetPath, notePath);
  return bridge.path.toFileUrl(absolutePath);
}

async function replaceAsync(
  value: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>,
): Promise<string> {
  const matches = Array.from(value.matchAll(pattern));
  if (matches.length === 0) {
    return value;
  }

  let cursor = 0;
  const parts: string[] = [];

  for (const match of matches) {
    const index = match.index ?? 0;
    parts.push(value.slice(cursor, index));
    parts.push(await replacer(...(match as unknown as string[])));
    cursor = index + match[0].length;
  }

  parts.push(value.slice(cursor));
  return parts.join('');
}

export async function resolveExportMarkdownAssetSources(
  markdown: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  const withMarkdownImages = await replaceAsync(
    markdown,
    /(!\[[^\]]*]\()([^)\s]+)(\))/g,
    async (_full, prefix, src, suffix) => {
      const resolvedSrc = await resolveAssetUrl(src, notesPath, notePath);
      return `${prefix}${resolvedSrc}${suffix}`;
    },
  );

  return replaceAsync(
    withMarkdownImages,
    /(<img\b[^>]*\bsrc=["'])(img:[^"']+)(["'][^>]*>)/gi,
    async (_full, prefix, src, suffix) => {
      const resolvedSrc = await resolveAssetUrl(src, notesPath, notePath);
      return `${prefix}${resolvedSrc}${suffix}`;
    },
  );
}
