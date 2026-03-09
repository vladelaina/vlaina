

<img width="2048" height="1152" alt="Gemini_Generated_Image_5y7o385y7o385y7o" src="https://github.com/user-attachments/assets/ec93951f-ace4-4af8-a5a2-e84225dfaf8c" />




<p align="center">
    <img src="https://count.getloli.com/@nekotick?name=nekotick&theme=booru-qualityhentais&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=auto" width="400">
  </p>

  
# NekoTick

## ⚖️ License & Copyright

This project is open-source under the **GNU AGPLv3 License**. You are free to study, modify, and distribute the code under the same license terms.

**Brand Guidelines:**  
Please note that the **NekoTick name, Logo, and visual assets** are proprietary trademarks and are **not** included in the open-source license.

If you wish to fork and redistribute this project, you must remove our branding assets.  
👉 Please read our **[Trademark & Forking Policy](TRADEMARK.md)** for detailed guidelines.

## ❤️ Open Source Credits

NekoTick is built on the shoulders of giants. We gratefully acknowledge the following open-source projects:

*   **[React](https://react.dev/)** - UI Library
*   **[Tauri](https://tauri.app/)** - App Framework
*   **[Milkdown](https://milkdown.dev/)** - WYSIWYG Markdown Editor
*   **[Heroicons](https://heroicons.com/)** - Iconography
*   **[Lucide](https://lucide.dev/)**, **[Ollama](https://ollama.com/)** & **[Primer Style](https://primer.style/)** - Selected UI design assets
*   **[JetBrains Mono](https://www.jetbrains.com/lp/mono/)** - The Typeface for Developers (OFL 1.1)
*   **[Radix UI](https://www.radix-ui.com/)** - Accessible UI Primitives
*   And many others listed in `package.json`.
*   Third-party license details: `THIRD_PARTY_NOTICES.md`

## ☁️ Cloud Sync

NekoTick uses GitHub as its sync backend. When you connect your GitHub account:

- A private repository named **`nekotick-config`** will be automatically created to sync your app configuration (calendar, todos, settings, AI chat configs) across devices.
- Your notebooks are synced via separate **`nekotick-*`** repositories, each visible in the app's vault panel.
- Cloud sync is available to all connected users.

All sync repositories are private and only accessible by you.

## 🛠️ Development

### Getting Started
1. Install dependencies: `pnpm install`
2. Start development server: `pnpm tauri dev`

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


This command automatically detects available ports to prevent conflicts and synchronizes configurations between Vite and Tauri. This is a recommended practice for maintaining a smooth development workflow across different environments and OS (Windows/macOS/Linux).

