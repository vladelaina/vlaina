import { describe, expect, it } from "vitest";
import { resolveOutsideMoveDecision } from "./SelectionInsertButton";

describe("resolveOutsideMoveDecision", () => {
  it("does nothing when the drag did not start from chat content", () => {
    expect(resolveOutsideMoveDecision({
      isSelectingFromChat: false,
      pointerInsideSelectionSurface: false,
      isSelectionFrozen: false,
    })).toEqual({
      nextFrozen: false,
      shouldPreventDefault: false,
      shouldRestore: false,
    });
  });

  it("allows selection to keep expanding inside assistant message content", () => {
    expect(resolveOutsideMoveDecision({
      isSelectingFromChat: true,
      pointerInsideSelectionSurface: true,
      isSelectionFrozen: true,
    })).toEqual({
      nextFrozen: false,
      shouldPreventDefault: false,
      shouldRestore: false,
    });
  });

  it("freezes selection while crossing user messages or message gaps", () => {
    expect(resolveOutsideMoveDecision({
      isSelectingFromChat: true,
      pointerInsideSelectionSurface: false,
      isSelectionFrozen: false,
    })).toEqual({
      nextFrozen: true,
      shouldPreventDefault: true,
      shouldRestore: true,
    });
  });
});
