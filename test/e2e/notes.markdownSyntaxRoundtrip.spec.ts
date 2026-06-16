import { expect, test, type Page } from '@playwright/test';
import {
  cleanupIsolatedElectron,
  getOpenBridgePages,
  launchIsolatedElectron,
  openAbsoluteNote,
  openMarkdownFixture,
} from './notesE2E';
import { createMarkdownSyntaxRoundtripCases } from './notesMarkdownSyntaxFixture';

const ROUNDTRIP_TAIL = 'Roundtrip tail sentinel';
const ROUNDTRIP_EDIT = 'roundtrip-edit-sentinel';

function withRoundtripTail(markdown: string): string {
  return `${markdown.replace(/\n+$/g, '')}\n\n${ROUNDTRIP_TAIL}.`;
}

function safeFilename(label: string): string {
  return `syntax-roundtrip-${label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.md`;
}

async function getCurrentNoteContent(page: Page): Promise<string> {
  return page.evaluate(() =>
    String((window as any).__vlainaE2E.getNotesState().currentNote?.content ?? '')
  );
}

async function typeRoundtripEditAtEnd(page: Page): Promise<void> {
  const focused = await page.evaluate(() => (window as any).__vlainaE2E.focusCurrentEditorAtEnd());
  expect(focused).toBe(true);
  await page.keyboard.type(ROUNDTRIP_EDIT);
  await expect.poll(async () => getCurrentNoteContent(page), { timeout: 10_000 })
    .toContain(ROUNDTRIP_EDIT);
}

function expectNoInternalPersistenceArtifacts(markdown: string, label: string): void {
  const leakedPatterns = [
    '\u0000',
    '\u200B',
    '\u200C',
    '\u2800',
    'VLAINA_LIST_GAP_SENTINEL',
    'VLAINA_USER_BR_SENTINEL',
    '<!--vlaina-markdown-blank-line-->',
    '<!--vlaina-markdown-tight-heading-->',
    'data-vlaina-empty-line',
    'date-vlaina-empty-line',
    'data-vlaina-list-gap',
    'date-vlaina-list-gap',
    'data-vlaina-user-br',
    'date-vlaina-user-br',
  ];

  for (const pattern of leakedPatterns) {
    expect(markdown, `${label} leaked internal persistence artifact ${JSON.stringify(pattern)}`)
      .not.toContain(pattern);
  }
}

test.describe('notes markdown syntax roundtrip persistence', () => {
  test.setTimeout(240_000);

  test('saves and reopens each supported syntax case without hidden line-break drift', async () => {
    const { app, userDataRoot } = await launchIsolatedElectron('notes-markdown-syntax-roundtrip');

    try {
      await app.firstWindow();
      const [page] = await getOpenBridgePages(app, 1);
      await page.setViewportSize({ width: 1280, height: 860 });

      for (const syntaxCase of createMarkdownSyntaxRoundtripCases()) {
        await test.step(syntaxCase.label, async () => {
          const opened = await openMarkdownFixture(page, {
            filename: safeFilename(syntaxCase.label),
            content: withRoundtripTail(syntaxCase.markdown),
          });

          await typeRoundtripEditAtEnd(page);

          await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
          const savedContent = await page.evaluate((pathToRead) =>
            (window as any).__vlainaE2E.readTextFile(pathToRead), opened.notePath
          );
          const currentContent = await getCurrentNoteContent(page);

          expect(savedContent, `${syntaxCase.label} disk content should match current note state after save`)
            .toBe(currentContent);
          expect(savedContent, `${syntaxCase.label} should persist the typed tail edit`)
            .toContain(ROUNDTRIP_EDIT);
          expectNoInternalPersistenceArtifacts(savedContent, syntaxCase.label);

          await openAbsoluteNote(page, opened.notePath);
          const reopenedContent = await getCurrentNoteContent(page);
          expect(reopenedContent, `${syntaxCase.label} should reopen to the saved markdown`)
            .toBe(savedContent);

          await page.evaluate(() => (window as any).__vlainaE2E.saveCurrentNote());
          const resavedContent = await page.evaluate((pathToRead) =>
            (window as any).__vlainaE2E.readTextFile(pathToRead), opened.notePath
          );
          expect(resavedContent, `${syntaxCase.label} should be stable after reopen and save`)
            .toBe(savedContent);
        });
      }
    } finally {
      await cleanupIsolatedElectron(app, userDataRoot);
    }
  });
});
