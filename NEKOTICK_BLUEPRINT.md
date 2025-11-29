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

## 6. 🚀 MVP Roadmap

### Phase 1: The Core (Local)
1.  **Architecture:** Setup Storage Repository & Markdown Parser.
2.  **UI Bone:** Standard Task List with "Add" button + Drag & Drop.
3.  **Command:** Basic implementation of `Cmd+K` (Hidden by default).
4.  **Build Pipeline:** Configure GitHub Actions for Portable builds (Win/Mac/Linux).

### Phase 2: The Features
1.  **Activity Heatmap:** Implementation of the stats view.
2.  **Time Auditing:** Add metadata fields to task details.

### Phase 3: The Cloud (Web)
1.  **API Strategy:** Implement Web fetch logic.
2.  **Sync:** Background synchronization.

---

## 🤖 AI Context Prompt (Copy-Paste)

*If you are switching AI tools, paste this prompt to sync context:*

"I am building **Nekotick**, a hybrid To-Do app using **Tauri v2 (Rust)** and **React (TypeScript)**.
**Key Features:**
1. **Markdown Storage:** Data is stored as local `.md` files.
2. **Portable:** Distributed as a no-install portable app.
3. **Capabilities:** **Activity Heatmap**, **Time Auditing**, and **Command Palette**.
**Design:** Notion-esque, Monochromatic, Custom CSS support.
**Stack:** Tailwind CSS, shadcn/ui, Framer Motion, cmdk, Zustand.
**UX Goal:** Intuitive default UI; Keyboard shortcuts are optional.
I am an experienced C/Open Source developer.
Please assist me based on the `NEKOTICK_BLUEPRINT.md` specifications."