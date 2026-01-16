# NekoTick

## ⚖️ License & Copyright

This project is open-source under the **GNU AGPLv3 License**. You are free to study, modify, and distribute the code under the same license terms.

**Brand Guidelines:**  
Please note that the **NekoTick name, Logo, and visual assets** are proprietary trademarks and are **not** included in the open-source license.

If you wish to fork and redistribute this project, you must remove our branding assets.  
👉 Please read our **[Trademark & Forking Policy](TRADEMARK.md)** for detailed guidelines.

## 🛠️ Development

### Getting Started
1. Install dependencies: `pnpm install`
2. Start development server: `pnpm tauri dev`

### Working with Multiple Instances (Worktrees)
If you are working on multiple features simultaneously using `git worktree` or otherwise need to run multiple instances of the app, use:
```bash
pnpm dev:dynamic
```

This command automatically detects available ports to prevent conflicts and synchronizes configurations between Vite and Tauri. This is a recommended practice for maintaining a smooth development workflow across different environments and OS (Windows/macOS/Linux).