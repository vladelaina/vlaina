import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { shouldBlockBrowserReservedShortcut } from "./browserGuards";

describe("shouldBlockBrowserReservedShortcut", () => {
  it("blocks Ctrl/Cmd+J and Ctrl/Cmd+P without Shift/Alt", () => {
    const ctrlJ = new KeyboardEvent("keydown", {
      key: "j",
      ctrlKey: true,
    });
    const metaJ = new KeyboardEvent("keydown", {
      key: "j",
      metaKey: true,
    });
    const ctrlP = new KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
    });
    const metaP = new KeyboardEvent("keydown", {
      key: "p",
      metaKey: true,
    });

    expect(shouldBlockBrowserReservedShortcut(ctrlJ)).toBe(true);
    expect(shouldBlockBrowserReservedShortcut(metaJ)).toBe(true);
    expect(shouldBlockBrowserReservedShortcut(ctrlP)).toBe(true);
    expect(shouldBlockBrowserReservedShortcut(metaP)).toBe(true);
  });

  it("does not block when Shift/Alt are pressed", () => {
    const ctrlShiftJ = new KeyboardEvent("keydown", {
      key: "j",
      ctrlKey: true,
      shiftKey: true,
    });
    const ctrlAltJ = new KeyboardEvent("keydown", {
      key: "j",
      ctrlKey: true,
      altKey: true,
    });

    expect(shouldBlockBrowserReservedShortcut(ctrlShiftJ)).toBe(false);
    expect(shouldBlockBrowserReservedShortcut(ctrlAltJ)).toBe(false);
  });

  it("does not block other keys", () => {
    const ctrlK = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
    });
    expect(shouldBlockBrowserReservedShortcut(ctrlK)).toBe(false);
  });

  it("only blocks the exact modifier+J/P shape under randomized input", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 3 }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (key, ctrlKey, metaKey, shiftKey, altKey) => {
          const event = new KeyboardEvent("keydown", {
            key,
            ctrlKey,
            metaKey,
            shiftKey,
            altKey,
          });

          const expected =
            (ctrlKey || metaKey) &&
            !shiftKey &&
            !altKey &&
            ["j", "p"].includes(key.toLowerCase());

          expect(shouldBlockBrowserReservedShortcut(event)).toBe(expected);
        },
      ),
      { numRuns: 150, seed: 20260412 },
    );
  });
});
