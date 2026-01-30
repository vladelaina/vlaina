## Coding Style Guidelines
**Comments Strategy: EXTREMELY RESTRAINED (Zero-Comment Default)**
* **Default Behavior:** DO NOT write comments. Assume the reader is a senior developer who understands the language syntax and standard libraries perfectly.
* **Strict Prohibition:** Never add comments explaining *what* the code does (e.g., `// loop through items`).
* **The Only Exception:** You may add a single-line comment ONLY if the logic is a non-standard "hack", a workaround for a specific bug, or mathematically complex business logic that cannot be expressed by variable names.
* **Principle:** Code must be self-documenting. If you feel the need to comment, refactor the code (e.g., rename variables/functions) instead.
