import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const appToChromiumLocaleAliases = new Map([
  ['en', ['en-US', 'en-GB']],
  ['zh-Hant', ['zh-TW']],
]);

async function getChromiumLocalesToKeep(projectDir) {
  const localesDir = path.join(projectDir, 'src', 'lib', 'i18n', 'locales');
  const entries = await readdir(localesDir, { withFileTypes: true });
  const locales = new Set(['en-US']);

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name) !== '.json') {
      continue;
    }

    const appLocale = path.basename(entry.name, '.json');
    const chromiumLocales = appToChromiumLocaleAliases.get(appLocale) ?? [appLocale];
    for (const chromiumLocale of chromiumLocales) {
      locales.add(chromiumLocale);
    }
  }

  return locales;
}

export default async function afterPack({ appOutDir, electronPlatformName, packager }) {
  if (electronPlatformName !== 'win32') {
    return;
  }

  const chromiumLocalesToKeep = await getChromiumLocalesToKeep(packager.projectDir);
  const localesDir = path.join(appOutDir, 'locales');
  let entries;
  try {
    entries = await readdir(localesDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || path.extname(entry.name) !== '.pak') {
      return;
    }

    const locale = path.basename(entry.name, '.pak');
    if (chromiumLocalesToKeep.has(locale)) {
      return;
    }

    await rm(path.join(localesDir, entry.name));
  }));
}
