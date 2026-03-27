<p align="center">
  <img src="https://github.com/user-attachments/assets/365f5581-077c-4715-a945-0310dde6c6fa" style="width:50%;">
  </p>

  
<p align="center">
    <img src="https://count.getloli.com/@vlaina?name=vlaina&theme=booru-qualityhentais&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=auto" width="400">
  </p>


  
# vlaina

## ⚖️ License & Copyright

This project is open-source under the **GNU AGPLv3 License**. You are free to study, modify, and distribute the code under the same license terms.

**Brand Guidelines:**  
Please note that the **vlaina name, Logo, and visual assets** are proprietary trademarks and are **not** included in the open-source license.

If you wish to fork and redistribute this project, you must remove our branding assets.  
👉 Please read our **[Trademark & Forking Policy](TRADEMARK.md)** for detailed guidelines.

## ❤️ Open Source Credits

vlaina is built on the shoulders of giants. We gratefully acknowledge the following open-source projects:

*   **[React](https://react.dev/)** - UI Library
*   **[Tauri](https://tauri.app/)** - App Framework
*   **[Milkdown](https://milkdown.dev/)** - WYSIWYG Markdown Editor
*   **[Heroicons](https://heroicons.com/)** - Iconography
*   **[Lucide](https://lucide.dev/)**, **[Ollama](https://ollama.com/)** & **[Primer Style](https://primer.style/)** - Selected UI design assets
*   **[JetBrains Mono](https://www.jetbrains.com/lp/mono/)** - The Typeface for Developers (OFL 1.1)
*   **[Radix UI](https://www.radix-ui.com/)** - Accessible UI Primitives
*   And many others listed in `package.json`.
*   Third-party license details: `THIRD_PARTY_NOTICES.md`

## Local-First

vlaina is a local-first editor.

- Your notes and workspace data live on your own device.
- Account sign-in is provider-agnostic and currently supports Google, 6-digit email codes, and GitHub.
- GitHub is optional. It is not required for note storage, managed AI access, or future sync setup.

## 🛠️ Development

### Getting Started
1. Install dependencies from Windows PowerShell or `cmd`: `pnpm install`
2. Start the desktop app from Windows PowerShell or `cmd`: `pnpm tauri dev`

WSL is for editing only in this repository. Do not run `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`, or `pnpm tauri ...` inside WSL against this shared working tree.

If you previously mixed WSL and Windows installs, delete `node_modules`, `node_modules/.vite`, and `.vite-temp`, then reinstall from Windows.

### Quality Gate (Pre-release)

Run the full quality gate in one command:

```bash
pnpm quality:gate
```

It runs `typecheck + tests + build` and enforces build budgets:

- unresolved asset warnings must be `0`
- largest `index-*.js` chunk must be `< 1500 kB`
- chunks over `500 kB` must be `<= 2`

Artifacts:

- build log: `temp/build-quality-gate.log`
- standalone budget check: `pnpm quality:budget`

### Working with Multiple Instances (Worktrees)
If you are working on multiple features simultaneously using `git worktree` or otherwise need to run multiple instances of the app, use:
```bash
pnpm dev:dynamic
```
## ✨Acknowledgements

With special appreciation to **湾中WanZhong** for the beautiful icon design.


<div align="center">

Copyright © 2026 - **vlaina**\
By vladelaina\
Made with ❤️ & ⌨️

</div>


