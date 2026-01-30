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

* **Magic Word:** If I type "Refactor This", you must essentially ignore the functional requirements and focus 100% on reducing complexity, splitting files, and improving readability.
