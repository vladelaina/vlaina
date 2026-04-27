# vlaina

`vlaina` is a local-first desktop workspace built with React, Vite, and Electron.

The current desktop host is Electron only. This repository does not keep a Tauri compatibility layer or runtime fallback.

## Highlights

- Local-first notes and workspace data
- Desktop app powered by Electron
- Notes, chat, vaults, assets, attachments, and account flows in one workspace
- Markdown editing based on Milkdown

## License

This repository is open-source under the GNU AGPLv3.

See [LICENSE](/mnt/d/code/vlaina/LICENSE).

## Development

Use Windows PowerShell or `cmd` for install, dev, test, and build.

WSL is fine for editing, but this repo intentionally blocks `install/dev/build/test` commands in WSL.

### Install

```bash
pnpm install
```

### Start desktop app

```bash
pnpm dev
```

This starts:

- Vite renderer
- Electron desktop shell

### Typecheck

```bash
pnpm typecheck
```

### Test

```bash
pnpm test
```

### Build

```bash
pnpm build
```

### Full verification

```bash
pnpm quality:verify
```

## CI

GitHub Actions runs the Windows build pipeline from [.github/workflows/build.yml](/mnt/d/code/vlaina/.github/workflows/build.yml):

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Notes

- If you previously mixed Windows and WSL installs, delete `node_modules` and reinstall from Windows.
- Electron is now the only desktop runtime target in this repository.
- Tauri runtime files, dependencies, compatibility layers, and data migrations are intentionally not supported.
