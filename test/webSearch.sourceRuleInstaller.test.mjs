import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('source quality rule installer', () => {
  it('writes reviewed host rules into the installed module format', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'source-rules-'));
    const inputPath = path.join(dir, 'reviewed.json');
    const outputPath = path.resolve('electron/webSearch/sourceQuality/installedSourceQualityRules.mjs');
    const before = await readFile(outputPath, 'utf8');

    await writeFile(inputPath, JSON.stringify({
      hardBlockedSites: ['Example.com', 'bad host', 'download.example.com'],
      lowPrioritySites: ['Blog.Example.org'],
      querySensitiveBlockedSites: {
        documents: ['Docs.Example.net'],
        health: ['Health.Example.net'],
      },
    }), 'utf8');

    try {
      await execFileAsync('node', ['scripts/web-search-install-source-rules.mjs', inputPath]);
      const after = await readFile(outputPath, 'utf8');

      expect(after).toContain("'example.com'");
      expect(after).toContain("'download.example.com'");
      expect(after).toContain("'blog.example.org'");
      expect(after).toContain("'docs.example.net'");
      expect(after).toContain("'health.example.net'");
      expect(after).not.toContain('bad host');
    } finally {
      await writeFile(outputPath, before, 'utf8');
    }
  });
});
