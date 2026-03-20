# Third-Party Notices

This project includes third-party materials, including custom icon assets and vendored editor source code.

## 1) Ollama Web UI

- Source: https://github.com/ollama/ollama
- Files used:
  - `src/components/ui/icons/custom/mit/NewChatIcon.tsx`
  - `src/components/ui/icons/custom/mit/SendIcon.tsx`
  - `src/components/ui/icons/custom/mit/SquareStopIcon.tsx`
- License: MIT
- License text: `licenses/ollama-MIT.txt`

## 2) Phosphor Icons

- Source: https://phosphoricons.com/
- Files used:
  - `src/components/ui/icons/custom/mit/TemporaryChatOffIcon.tsx`
  - `src/components/ui/icons/custom/mit/TemporaryChatOnIcon.tsx`
- License: MIT
- License text: `licenses/phosphor-icons-MIT.txt`

## 3) Lucide

- Source: https://lucide.dev/
- Files used:
  - `src/components/ui/icons/custom/mit/CropIcon.tsx`
  - `src/components/ui/icons/custom/mit/RenameIcon.tsx`
  - `src/components/ui/icons/custom/mit/SquareCheckBigIcon.tsx`
- License: ISC (with MIT notice for Feather-derived portions)
- License text: `licenses/lucide-react-LICENSE.txt`

## 4) Primer Style

- Source: https://primer.style/
- Files used:
  - `src/components/ui/icons/custom/mit/PrimerPinIcon.tsx`
  - `src/components/ui/icons/custom/mit/PrimerUnpinIcon.tsx`
- License: MIT
- License text: `licenses/primer-style-MIT.txt`

## 5) Milkdown

- Source: https://github.com/Milkdown/milkdown
- Files used:
  - `vendor/milkdown/`
  - Workspace-linked packages under `vendor/milkdown/packages/*`
- Local use:
  - Vendored editor source is included in this repository.
  - The app uses local workspace-linked Milkdown packages and may contain project-specific modifications.
- License: MIT
- License text: `licenses/milkdown-MIT.txt`

## 6) CodeMirror

- Source: https://codemirror.net/
- Packages used by the local code block implementation:
  - `@codemirror/language`
  - `@codemirror/language-data`
  - `@codemirror/state`
  - `@codemirror/theme-one-dark`
  - `@codemirror/view`
- Local use:
  - These packages power the project's locally maintained code block editor integration under `src/components/Notes/features/Editor/plugins/code/`.
- License: MIT
- License text: `licenses/codemirror-MIT.txt`
