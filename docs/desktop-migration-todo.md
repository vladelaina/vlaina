# Desktop Migration TODO

## Policy

- Electron is the only desktop runtime in this repository.
- Do not add a Tauri compatibility layer, Tauri data migration, or Tauri runtime fallback.
- Web code stays for the hosted web product, tests, and shared renderer logic. Do not keep Web branches as desktop runtime compatibility.

## Status

- [x] Electron main process is the package entry point.
- [x] Electron preload bridge exposes the desktop APIs used by the renderer.
- [x] Electron Builder packaging config is present.
- [x] Tauri runtime files, config, and package dependencies are absent.
- [x] Project install config pins the Electron binary mirror for reliable installs.
- [x] Quality checks include a guard against reintroducing Tauri runtime markers.

## Remaining Work

- [x] Harden Electron filesystem IPC with explicit authorized roots.
- [x] Keep the hosted web target as a separate product surface, not as desktop runtime compatibility.
- [ ] Keep business code behind `src/lib/desktop/*` adapters and avoid new direct Electron calls outside the desktop bridge layer.
- [ ] Add an Electron packaging smoke test once install/build is stable on the target OS.
