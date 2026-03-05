# Editor Hardening Checklist

Last Updated: 2026-03-04 (Asia/Shanghai)
Scope: Markdown paste reliability, cursor behavior consistency, build warnings, bundle size.

## Execution Rules

- [x] Keep this checklist as the single source of truth across context windows.
- [x] Complete items in order unless a blocker is found.
- [x] Every finished item must include measurable evidence.

## Phase 0 - Baseline Freeze

- [x] Record current `tsc` status.
- [x] Record current `vitest` full-suite status.
- [x] Record current `build` warnings summary.
- [x] Record current top bundle chunks and sizes.
- [x] Define pass/fail targets for Phase 2 and Phase 3.

Evidence:

- `tsc`: pass (`pnpm exec tsc --noEmit --pretty false`).
- `vitest`: pass (`29 files / 231 tests`).
- `build`: pass (`pnpm build`) with warnings.
- Unresolved font warnings: `356` total.
  - KaTeX fonts unresolved: `60`
  - `@fontsource/*` files unresolved: `296`
- Chunk warning: `Some chunks are larger than 500 kB` (present).
- Top chunks (raw size):
  - `dist/assets/index-4vy_BuYx.js`: `3,791.83 kB` (gzip `1,098.84 kB`)
  - `dist/assets/emacs-lisp-C9XAeP06.js`: `779.85 kB`
  - `dist/assets/cpp-CofmeUqb.js`: `626.08 kB`
  - `dist/assets/wasm-CG6Dc4jp.js`: `622.34 kB`
  - `dist/assets/mermaid.core-CEyKuLqR.js`: `467.76 kB`

Targets:

- Phase 2 target: unresolved font warnings = `0`.
- Phase 3 target:
  - Main index chunk < `1,500 kB`.
  - Total chunks > `500 kB` reduced to `<= 2`.
  - Keep tests/build green.

## Phase 1 - Regression Safety (Paste + Cursor)

- [x] Restore paste regression tests (fenced code / heading / markdown signal detection).
- [x] Restore cursor-tail position tests.
- [x] Add edge-case tests for trailing space and short text.
- [x] Run targeted clipboard test suite.
- [x] Run full test suite and ensure green.

Evidence:

- Added tests:
  - `src/components/Notes/features/Editor/plugins/clipboard/fencedCodePaste.test.ts`
  - `src/components/Notes/features/Editor/plugins/clipboard/pasteCursorUtils.test.ts`
- Clipboard targeted run: `2 files / 25 tests` pass.
- Full suite run: `31 files / 256 tests` pass.

## Phase 2 - Font Warning Elimination

- [x] Identify exact source files generating unresolved font warnings.
- [x] Fix KaTeX font path resolution in build.
- [x] Fix `@fontsource/*` runtime unresolved warnings in build.
- [x] Re-run build and verify unresolved font warnings = 0.

Evidence:

- Root cause: `index.css` used CSS `@import` for `katex` + `@fontsource/*`; Vite left nested asset URLs unresolved at build time.
- Fix:
  - Added explicit JS-side imports in `src/fontImports.ts`.
  - Imported `src/fontImports.ts` from `src/main.tsx`.
  - Removed font and KaTeX `@import` entries from `src/index.css`.
  - Switched to `latin-*` subsets for fontsource imports.
- Result: `didn't resolve at build time` warnings reduced from `356` to `0`.

## Phase 3 - Chunk Size Reduction

- [x] Identify heaviest eager-loaded modules (editor/runtime).
- [x] Apply targeted lazy loading for large optional modules.
- [x] Configure manual chunk split for stable boundaries.
- [x] Re-run build and compare before/after main chunk size.
- [x] Ensure app behavior unchanged with smoke checks.

Evidence:

- Removed startup prewarm of Shiki full bundle (`src/main.tsx` no longer preloads `lib/highlighter`).
- Replaced Chat full `highlight.js` import with core + selected languages (`src/components/Chat/features/Markdown/utils/chatHighlighter.ts`).
- Decoupled emoji-heavy imports from eager path:
  - `featureSlice` skin-tone migration now uses dynamic import.
  - random emoji acquisition moved to async helper (`randomEmoji.ts`).
  - `UniversalIcon` no longer statically imports `EMOJI_MAP`.
- Lazy-loaded icon picker entry points from:
  - `HeroIconHeader.tsx`
  - `IconSelector.tsx`
  - `PreviewSection.tsx`
- Limited editor highlighter to controlled language set and removed all-language runtime expansion (`src/components/Notes/features/Editor/utils/shiki.ts`).
- Lazy-loaded main app view stacks in `src/App.tsx` (`Calendar/Notes/Todo/Chat/Lab`, sidebars, settings, title controls).
- Measured build progression:
  - Baseline: `index-*.js = 3,791.83 kB`
  - After chat highlighter + prewarm removal: `index-*.js = 2,807.77 kB`
  - After emoji/import + lazy loading refactors: `index-*.js = 585.06 kB`
- Final Phase 3 build (`temp/build-phase3f.log`):
  - main index chunk: `585.06 kB` (< `1,500 kB` target)
  - chunks > `500 kB`: `2` (`index-C6qrebYL.js`, `NotesView-DW6Ap9pb.js`) (<= `2` target)
  - unresolved font warnings: `0`

## Phase 4 - Permanent Quality Gate

- [x] Add one-command pre-release verification script (`typecheck + tests + build`).
- [x] Add bundle/warning budget check script.
- [x] Document usage in README / docs.
- [x] Final verification run.

Evidence:

- Added scripts:
  - `scripts/quality-gate.mjs`
  - `scripts/check-build-budget.mjs`
- Added npm scripts in `package.json`:
  - `typecheck`, `test`
  - `quality:verify`
  - `quality:budget`
  - `quality:gate`
- Added usage docs in `README.md` ("Quality Gate (Pre-release)").
- Final verification:
  - `pnpm quality:gate` passes on Windows toolchain path.
  - Full tests: `31 files / 256 tests` pass.
  - Build budget check: pass (`main index 585.06 kB`, chunks >500k = `2`, unresolved warnings = `0`).

## Progress Log

### 2026-03-04

- Created checklist and started execution.
- Baseline captured and frozen with measurable targets.
- Phase 1 completed and verified green.
- Phase 2 completed: unresolved font warnings eliminated.
- Phase 3 completed: startup and feature chunks split; main index reduced to 585.06 kB; chunk-count target met.
- Phase 4 completed: one-command quality gate and budget enforcement added with passing final run.
