## Coding Style Guidelines
**Comments Strategy: EXTREMELY RESTRAINED (Zero-Comment Default)**
* **Default Behavior:** DO NOT write comments. Assume the reader is a senior developer who understands the language syntax and standard libraries perfectly.
* **Strict Prohibition:** Never add comments explaining *what* the code does (e.g., `// loop through items`).
* **The Only Exception:** You may add a single-line comment ONLY if the logic is a non-standard "hack", a workaround for a specific bug, or mathematically complex business logic that cannot be expressed by variable names.
* **Principle:** Code must be self-documenting. If you feel the need to comment, refactor the code (e.g., rename variables/functions) instead.


## Complexity & Refactoring Guardrails
**Mandatory Pre-Flight Check:**
Before implementing any new feature or fix, evaluate the current file/function context against these limits:

1.  **Single Responsibility Principle (SRP):** Does the current file/function already do too much? If adding this code creates a "God Object," STOP.
2.  **Size Thresholds (Heuristic):**
    * **Function Length:** If a function exceeds ~50 lines.
    * **File Size:** If a file exceeds ~300 lines (or feels cluttered).
    * **Nesting:** If indentation exceeds 3-4 levels.

**Protocol for Violation:**
If the request would cause the code to violate these thresholds:
* **DO NOT** simply append the code.
* **INSTEAD**, output a **Warning Block** first:
    > ⚠️ **Refactoring Recommended**: The target file/function is becoming too complex. I suggest extracting logic into a new [Function/Class/File] named `X` before proceeding.
* Wait for user confirmation OR provide the refactored solution structure immediately if the user implies autonomy.


## Output Completeness **No "Lazy" Placeholders:** * Unless explicitly asked to "summarize" or "show diff only", you must output the **FULL, WORKING code**. * **Strictly Prohibited:** Do not use // ... existing code ... or // ... rest of implementation. * If modifying a large file, output the complete function or the complete file so it can be directly piped/copied.

* **Magic Word:** If I type "Refactor This", you must essentially ignore the functional requirements and focus 100% on reducing complexity, splitting files, and improving readability.


## UI & Visual Standards
**Iconography: UNIFIED 18px Standard**
* **Mandatory Size:** All functional and decorative icons MUST be sized at exactly **18px**.
* **Implementation:** 
  * Use Tailwind classes: `size-[18px]` or `w-[18px] h-[18px]`.
  * For components with a `size` prop (like `UniversalIcon` or `AppIcon`), use `size={18}`.
* **Specific Exceptions:**
  * **Delete/Trash Icon:** MUST use the custom `<DeleteIcon />` component (`@/components/common/DeleteIcon`).

**Button Styles: SHARED UTILITIES**
* **Icon Buttons:** Use the shared `iconButtonStyles` constant from `@/lib/utils` for standard, borderless icon buttons (e.g., window controls, toolbar actions).
  * **Style:** Transparent background, tertiary text color by default, primary text color on hover.
  * **Usage:** `className={cn("...", iconButtonStyles)}`
* **Rationale:** To ensure consistent hover states and interaction feedback across the application.
* **Rationale:** To ensure visual consistency, accessibility, and professional appearance throughout the application.
