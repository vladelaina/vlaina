# 📘 NEKOTICK PROJECT BLUEPRINT

> **Core Philosophy:** Aesthetic, Lightweight, High-Performance, Data Sovereignty.
> **UX Goal:** Intuitive default UI, with optional depth for advanced users.

## 1. 🎯 Project Vision
**What is Nekotick?**
A cross-platform (**Desktop, Mobile, Web**) To-Do and Time Management application.
**Distribution Strategy:**
* **Desktop:** **Portable / No-Install**. Distributed as single binary/zip (Windows) or AppImage (Linux). No registry pollution.
* **Mobile/Web:** Standard app distribution.

**Key Focus:**
1.  **Extreme Lightness:** Built with Rust/Tauri (<10MB target).
2.  **Notion-esque Aesthetics:** Clean, monochromatic, content-first.
3.  **Hybrid Architecture:** Unified UI for both Local FS and Web API.
4.  **Hackable UI:** CSS-variable based theming.

## 2. ⚡ Key Capabilities

### 1. Activity Visualization
* **Function:** Displays task completion density over time using a calendar heatmap (similar to contribution graphs).
* **Placement:** Located in a dedicated "Statistics" view to avoid cluttering the main task list.

### 2. Time Auditing
* **Function:** Tracks "Estimated Duration" vs "Actual Duration" for tasks.
* **Implementation:**
    * **Data:** Stored in Markdown frontmatter (`estimated: 30m`, `actual: 45m`).
    * **Reporting:** Generates simple summaries of time expenditure by tag/category.

### 3. Command Interface
* **Function:** Global Command Palette (`Cmd/Ctrl + K`) for keyboard-centric navigation.
* **Behavior:**
    * **Default:** Hidden. The UI relies on standard mouse/touch interactions.
    * **Advanced:** Users can trigger the palette to jump between lists, add tasks quickly, or toggle settings.
    * **VIM Mode:** Optional configuration to enable VIM-style navigation (`j/k` to move, `x` to complete).

## 3. 🛠️ Tech Stack (Non-Negotiable)

This project strictly adheres to the following technology choices:

### Core Architecture
* **Framework:** **Tauri v2** (Rust) - *Desktop/Mobile.*
* **Frontend:** **React 18+** (TypeScript).
* **Build:** Vite + pnpm.
* **Packaging:** **Portable Mode** (Zip/AppImage targets) preferred over installers.

### UI & UX System
* **Styling:** **Tailwind CSS**.
* **Components:** **shadcn/ui** (Radix UI).
* **Command Palette:** **cmdk**.
* **Animations:** **Framer Motion**.
* **Drag & Drop:** **dnd-kit**.
* **Charts:** **react-activity-calendar**.

### State & Storage (The "Repository Pattern")
* **Data Format:** **Markdown** (Content) + **JSON** (Index/Metadata).
* **Storage Interface:**
    * `LocalFileStrategy` (Tauri FS) - *Portable logic: checks executable directory first.*
    * `RemoteApiStrategy` (Web API).
* **State:** **Zustand**.

## 4. 🎨 Design Guidelines (The "Notion" Look)

* **Visual Style:** **"Content First"**. Monochromatic, clean typography.
* **Customizability:** User `custom.css` injection.
* **Layout:** Block-based, generous padding.
* **Dark Mode:** Native support.

### Color Palette (Zinc-based Monochrome)

**Core Philosophy:** Minimize color distractions. Use subtle grays (Zinc) throughout the interface.

#### Primary Colors (Zinc Scale)
```
Base Background:
  - Light Mode: white / zinc-50
  - Dark Mode: zinc-900

Text:
  - Primary: zinc-900 (light) / zinc-100 (dark)
  - Secondary: zinc-600 (light) / zinc-400 (dark)
  - Muted: zinc-400 (light) / zinc-600 (dark)

Borders:
  - Default: zinc-200 (light) / zinc-700 (dark)
  - Hover: zinc-300 (light) / zinc-600 (dark)

Interactive Elements:
  - Hover Background: zinc-50 (light) / zinc-800 (dark)
  - Active Background: zinc-100 (light) / zinc-800 (dark)
```

#### Accent Colors (AVOID when possible)
```
Toggle Switches / Checkboxes:
  - OFF: zinc-200 (light) / zinc-700 (dark)
  - ON: zinc-400 (light) / zinc-500 (dark)
  ❌ DO NOT USE: Blue, Green, or any vibrant colors

Exceptions (Minimal use):
  - Error States: red-500 (sparingly)
  - Destructive Actions: red-500 hover on buttons
```

#### Component-Specific Guidelines
```
Search Input:
  - Placeholder: zinc-400
  - Border: zinc-200 (light) / zinc-700 (dark)
  - Background: transparent

Sidebar:
  - Background: white (light) / zinc-900 (dark)
  - Divider: zinc-200 (light) / zinc-700 (dark)
  - Active Item: zinc-100 (light) / zinc-800 (dark)

Task Items:
  - Default: transparent
  - Hover: zinc-50 (light) / zinc-800/50 (dark)
  - Completed Text: zinc-400 with line-through
```

**Design Rule:** If you're considering adding color, ask: "Can this be communicated with typography or spacing instead?"

## 5. 📝 Coding Standards

### TypeScript (Frontend)
* **Strict Typing:** No `any`. Define Interfaces (`Task`, `TimeLog`) first.
* **Architecture:** Separation of concerns (UI vs Storage Logic).
* **File Structure:**
    ```text
    src/
    ├── components/
    │   ├── ui/          # shadcn components
    │   ├── features/    # Business components
    ├── lib/             # Parsers (Markdown natural language)
    ├── services/        # Storage Repositories
    ├── stores/          # Zustand stores
    └── types/           # TS Interfaces
    ```

### Rust (Backend - Tauri Only)
* **Safety:** Handle errors explicitly.
* **Role:** High-performance File I/O and Global Shortcut registration.

