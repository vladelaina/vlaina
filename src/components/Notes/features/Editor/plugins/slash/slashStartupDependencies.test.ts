import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSlashSource(fileName: string) {
  return readFileSync(
    resolve(process.cwd(), `src/components/Notes/features/Editor/plugins/slash/${fileName}`),
    'utf8',
  );
}

describe('slash command startup dependencies', () => {
  it('loads image filesystem and library UI only after the image command runs', () => {
    const definitions = readSlashSource('slashCommandDefinitions.ts');
    const imageCommand = readSlashSource('slashImageCommand.ts');

    expect(definitions).not.toContain("from './slashFileCommands'");
    expect(definitions).not.toContain("from './slashImageLibrarySession'");
    expect(imageCommand).toContain("import('./slashImageLibrarySession')");
    expect(imageCommand).toContain("import('./slashFileCommands')");
  });

  it('loads the emoji picker UI only after the emoji command runs', () => {
    const emojiCommand = readSlashSource('slashEmojiCommand.ts');

    expect(emojiCommand).not.toContain("from './slashEmojiPickerSession'");
    expect(emojiCommand).toContain("import('./slashEmojiPickerSession')");
  });
});
