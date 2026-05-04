## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Keep code, comments, and test fixture text in English unless user-facing copy requires another language.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Keep Files Concise

**Target a maximum of 300 lines per file.**
Test files may be longer when the extra length is meaningful coverage, but keep them under 500 lines.
If a non-test file exceeds 300 lines, or a test file exceeds 500 lines, propose a logical split into smaller modules.

## 6. Commit Messages

**Use emoji + conventional keyword + scope.**

When creating commits:
- Only commit when the user explicitly asks for a commit.
- Format commit messages as `emoji type(scope): subject`.
- Keep the subject short, imperative, and specific.
- Match the type to the change, such as `fix`, `feat`, `refactor`, `test`, `docs`, `chore`.
- Example: `🐛fix(shortcuts): block background shortcuts while dialogs are focused`

## 7. Merge Conflicts

**Prefer the latest side, but still reason through the merge.**

When resolving conflicts:
- Treat incoming/latest as the default baseline, not as a blind overwrite rule.
- Compare both sides for behavior, imports, types, tests, and surrounding dependencies.
- Preserve the latest intent unless it breaks the current main branch or drops a necessary existing fix.
- If the latest side is stale against main, apply the smallest compatibility fix instead of keeping both versions.
- After resolving, check for conflict markers, unmerged paths, compile or type issues, and run the most relevant tests when practical.

## 8. Local Milkdown Vendor

**`vendor/milkdown` is fully maintained locally.**

When a task involves Milkdown behavior, schemas, commands, plugins, or editor internals:
- Inspect and modify `vendor/milkdown` directly when that is the correct layer.
- Do not avoid vendor changes by adding workaround code in app-level editor plugins.
- Keep vendor edits as surgical as any other code change, and verify them with the most relevant app and vendor-facing tests.
