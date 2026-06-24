import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FILE_TREE_FILE_SELECTOR,
  cleanupIsolatedElectron,
  createVaultFilesFixture,
  getOpenBridgePages,
  launchIsolatedElectron,
  openVaultInNotes,
} from './notesE2E';

test.describe('notes open file location', () => {
  test.skip(process.platform !== 'linux', 'Linux file manager reveal behavior is platform-specific.');

  test('reveals a sidebar markdown file through the Linux file manager', async () => {
    const shellFixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vlaina-open-location-e2e-'));
    const fakeBinDir = path.join(shellFixtureRoot, 'bin');
    const shellLogPath = path.join(shellFixtureRoot, 'shell.log');
    await fs.mkdir(fakeBinDir, { recursive: true });
    await fs.writeFile(
      path.join(fakeBinDir, 'gdbus'),
      [
        '#!/usr/bin/env sh',
        'printf "cmd=gdbus\\n" >> "$VLAINA_E2E_SHELL_LOG"',
        '{',
        '  printf "argc=%s\\n" "$#"',
        '  for arg in "$@"; do',
        '    printf "arg=%s\\n" "$arg"',
        '  done',
        '} >> "$VLAINA_E2E_SHELL_LOG"',
        'exit 0',
        '',
      ].join('\n'),
      { mode: 0o755 },
    );
    await fs.writeFile(
      path.join(fakeBinDir, 'nautilus'),
      [
        '#!/usr/bin/env sh',
        'printf "cmd=nautilus\\n" >> "$VLAINA_E2E_SHELL_LOG"',
        '{',
        '  printf "argc=%s\\n" "$#"',
        '  for arg in "$@"; do',
        '    printf "arg=%s\\n" "$arg"',
        '  done',
        '} >> "$VLAINA_E2E_SHELL_LOG"',
        'exit 0',
        '',
      ].join('\n'),
      { mode: 0o755 },
    );

    const { app, userDataRoot } = await launchIsolatedElectron('notes-open-file-location', {
      envOverrides: {
        PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}`,
        VLAINA_E2E_SHELL_LOG: shellLogPath,
      },
    });

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);

      const fixture = await createVaultFilesFixture(page, {
        name: 'open-file-location',
        files: [
          { filename: 'target.md', content: '# Target\n\nOpen location sentinel.\n' },
          { filename: 'other.md', content: '# Other\n\nOther sentinel.\n' },
        ],
      });
      const expectedNotePath = fixture.notePaths.find((notePath) => notePath.endsWith('/target.md'));
      if (!expectedNotePath) {
        throw new Error('Expected target.md fixture path to be created.');
      }
      const expectedFileUrlArgument = `arg=['${pathToFileURL(expectedNotePath).toString()}']`;

      await openVaultInNotes(page, {
        vaultPath: fixture.vaultPath,
        name: 'Open File Location Vault',
        minFileCount: 2,
      });

      const targetRow = page.locator(FILE_TREE_FILE_SELECTOR, { hasText: 'target' }).first();
      await expect(targetRow).toBeVisible();
      await targetRow.click({ button: 'right' });
      await expect(page.locator('[data-sidebar-context-menu-layer="true"]').first()).toBeVisible();

      await page.getByRole('button', { name: /^(More|更多)$/ }).hover();
      await expect(page.locator('[data-sidebar-context-menu-item="open-location"]')).toBeVisible();
      await page.locator('[data-sidebar-context-menu-item="open-location"]').click();

      await expect.poll(async () => {
        return fs.readFile(shellLogPath, 'utf8').catch(() => '');
      }, { timeout: 10_000 }).toContain(expectedFileUrlArgument);

      const shellLog = await fs.readFile(shellLogPath, 'utf8');
      expect(shellLog).toContain('cmd=gdbus');
      expect(shellLog).toContain('arg=org.freedesktop.FileManager1.ShowItems');
      expect(shellLog).toContain(expectedFileUrlArgument);
      expect(shellLog).toContain('cmd=nautilus');
      expect(shellLog).toContain('arg=--select');
      expect(shellLog).toContain(`arg=${expectedNotePath}`);
      expect(shellLog).not.toContain('arg=--new-window');
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
      await fs.rm(shellFixtureRoot, { recursive: true, force: true });
    }
  });
});
