import { describe, expect, it } from "vitest";
import { getModuleShortcutPreset } from "./moduleShortcuts";

describe("getModuleShortcutPreset", () => {
  it("includes the embedded chat shortcuts in the notes shortcut preset", () => {
    const preset = getModuleShortcutPreset("notes");
    const chatSection = preset.sections.find((section) => section.title === "Chat");

    expect(chatSection).toBeDefined();
    expect(chatSection?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Open new chat", keys: ["Ctrl", "Shift", "O"] }),
        expect.objectContaining({
          action: "Open temporary chat (toggle if empty)",
          keys: ["Ctrl", "Shift", "J"],
        }),
      ]),
    );
  });
});
