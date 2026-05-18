
<p align="center">
  <img src="https://github.com/user-attachments/assets/fddfaa4c-b085-40e7-98aa-bffbc0d1fe75" style="width:50%;">
  </p>


  
<p align="center">
    <img src="https://count.getloli.com/@vlaina?name=vlaina&theme=booru-qualityhentais&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=auto" width="400">
  </p>


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

See [LICENSE](LICENSE).

## Privacy

See [PRIVACY.md](PRIVACY.md) for a summary of how vlaina handles local data, AI provider requests, account features, web access, and update checks.

## Third-Party Notices

This project includes and adapts third-party open-source material. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and license
details.

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

GitHub Actions runs the build pipeline from [.github/workflows/build.yml](.github/workflows/build.yml):

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Tagged releases matching `v*` build Windows, macOS, and Linux x64/arm64 desktop installers and publish them to GitHub Releases.

## Notes

- If you previously mixed Windows and WSL installs, delete `node_modules` and reinstall from Windows.
- Electron is now the only desktop runtime target in this repository.
- Tauri runtime files, dependencies, compatibility layers, and data migrations are intentionally not supported.


<div align="center">

Copyright © 2026 - **vlaina**\
By vladelaina\
Made with ❤️ & ⌨️

</div>

