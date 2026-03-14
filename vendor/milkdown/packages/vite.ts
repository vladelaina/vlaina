import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type UserConfig } from 'vite';

type ExternalMatcher = string | RegExp;

interface PluginViteConfigOptions extends UserConfig {
    external?: ExternalMatcher[];
}

function collectSourceEntries(rootDir: string): string[] {
    const entries: string[] = [];
    const stack = [rootDir];

    while (stack.length > 0) {
        const currentDir = stack.pop();
        if (!currentDir) continue;

        const children = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const child of children) {
            const childPath = path.join(currentDir, child.name);

            if (child.isDirectory()) {
                if (child.name === '__tests__' || child.name === '__snapshots__') continue;
                stack.push(childPath);
                continue;
            }

            if (!/\.(ts|tsx|js|jsx|css)$/.test(child.name)) continue;
            if (/\.(test|spec)\.[^.]+$/.test(child.name)) continue;
            entries.push(childPath);
        }
    }

    return entries.sort();
}

function createExternalMatchers(packageDir: string, extraExternal: ExternalMatcher[]): ExternalMatcher[] {
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
    };

    return [
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.peerDependencies ?? {}),
        /@milkdown\/prose/,
        ...extraExternal,
    ];
}

export function pluginViteConfig(metaUrl: string, options: PluginViteConfigOptions = {}) {
    const packageDir = path.dirname(fileURLToPath(metaUrl));
    const srcDir = path.join(packageDir, 'src');
    const {
        external = [],
        build: userBuild,
        ...restOptions
    } = options;

    const baseConfig = defineConfig({
        build: {
            outDir: path.join(packageDir, 'lib'),
            emptyOutDir: true,
            sourcemap: true,
            minify: false,
            target: 'es2020',
            cssCodeSplit: true,
            rollupOptions: {
                input: collectSourceEntries(srcDir),
                external: createExternalMatchers(packageDir, external),
                preserveEntrySignatures: 'exports-only',
                output: {
                    format: 'es',
                    preserveModules: true,
                    preserveModulesRoot: srcDir,
                    entryFileNames: '[name].js',
                    chunkFileNames: 'shared/[name]-[hash].js',
                    assetFileNames: '[name][extname]',
                },
            },
        },
    });

    return mergeConfig(baseConfig, {
        ...restOptions,
        build: userBuild,
    });
}
