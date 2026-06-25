import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import viteConfig from '../../vite.config';
import vitestConfig from '../../vitest.config';

const reactSingletonPackages = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'scheduler',
] as const;

function readText(path: string) {
  return readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
}

async function resolveConfig(configExport: unknown) {
  if (typeof configExport === 'function') {
    return (configExport as (env: {
      command: 'build';
      mode: 'production';
      isSsrBuild: boolean;
      isPreview: boolean;
    }) => unknown)({
      command: 'build',
      mode: 'production',
      isSsrBuild: false,
      isPreview: false,
    });
  }

  return configExport;
}

describe('React singleton resolution', () => {
  it('dedupes React packages in Vite production builds', async () => {
    const config = await resolveConfig(viteConfig);
    const dedupe = new Set((config as { resolve?: { dedupe?: string[] } }).resolve?.dedupe ?? []);

    for (const packageName of reactSingletonPackages) {
      expect(dedupe.has(packageName)).toBe(true);
    }
  });

  it('does not manually chunk modules that can absorb React dependencies', async () => {
    const config = await resolveConfig(viteConfig);
    const output = (config as {
      build?: {
        rollupOptions?: {
          output?: {
            manualChunks?: (id: string) => string | undefined;
          };
        };
      };
    }).build?.rollupOptions?.output;

    expect(output?.manualChunks?.('/repo/src/lib/i18n/index.ts')).toBeUndefined();
    expect(output?.manualChunks?.('/repo/node_modules/.pnpm/framer-motion@12.40.0_react@19.2.7/node_modules/framer-motion/dist/es/index.mjs')).toBeUndefined();
  });

  it('dedupes React packages in Vitest module resolution', async () => {
    const config = await resolveConfig(vitestConfig);
    const dedupe = new Set((config as { resolve?: { dedupe?: string[] } }).resolve?.dedupe ?? []);

    for (const packageName of reactSingletonPackages) {
      expect(dedupe.has(packageName)).toBe(true);
    }
  });

  it('pins React packages through pnpm workspace overrides', () => {
    const workspace = readText('pnpm-workspace.yaml');

    expect(workspace).toMatch(/overrides:\n(?:  .+\n)*  react: 19\.2\.7\n/);
    expect(workspace).toMatch(/overrides:\n(?:  .+\n)*  react-dom: 19\.2\.7\n/);
  });

  it('keeps the Milkdown React integration on host React peers', () => {
    const packageJson = JSON.parse(
      readText('vendor/milkdown/packages/integrations/react/package.json'),
    ) as {
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(packageJson.peerDependencies?.react).toBe('*');
    expect(packageJson.peerDependencies?.['react-dom']).toBe('*');
    expect(packageJson.dependencies?.react).toBeUndefined();
    expect(packageJson.dependencies?.['react-dom']).toBeUndefined();
  });

  it('does not keep stale React 19.2.4 packages in the lockfile', () => {
    const lockfile = readText('pnpm-lock.yaml');

    expect(lockfile).not.toContain('react@19.2.4');
    expect(lockfile).not.toContain('react-dom@19.2.4');
  });
});
