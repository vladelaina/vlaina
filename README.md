

<img width="2048" height="1152" alt="Gemini_Generated_Image_5y7o385y7o385y7o" src="https://github.com/user-attachments/assets/ec93951f-ace4-4af8-a5a2-e84225dfaf8c" />


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
*   **[Material Design Icons](https://github.com/google/material-design-icons)** - Iconography (Apache 2.0)
*   **[Radix UI](https://www.radix-ui.com/)** - Accessible UI Primitives
*   And many others listed in `package.json`.

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
