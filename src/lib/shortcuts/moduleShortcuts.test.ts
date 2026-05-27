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
          action: "Open temporary chat",
          keys: ["Ctrl", "Shift", "J"],
        }),
      ]),
    );
  });

  it("includes Typora editor shortcuts in the notes shortcut preset", () => {
    const preset = getModuleShortcutPreset("notes");
    const paragraphSection = preset.sections.find((section) => section.title === "Paragraph");
    const formatSection = preset.sections.find((section) => section.title === "Format");
    const viewSection = preset.sections.find((section) => section.title === "View");

    expect(paragraphSection?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Heading 1", keys: ["Ctrl", "1"] }),
        expect.objectContaining({ action: "Insert table", keys: ["Ctrl", "T"] }),
        expect.objectContaining({ action: "Math block", keys: ["Ctrl", "Shift", "M"] }),
        expect.objectContaining({ action: "Ordered list", keys: ["Ctrl", "Shift", "["] }),
        expect.objectContaining({ action: "Bullet list", keys: ["Ctrl", "Shift", "]"] }),
      ]),
    );
    expect(formatSection?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Strikethrough", keys: ["Ctrl", "Shift", "5"] }),
        expect.objectContaining({ action: "Inline code", keys: ["Ctrl", "Shift", "`"] }),
        expect.objectContaining({ action: "Clear formatting", keys: ["Ctrl", "\\"] }),
      ]),
    );
    expect(viewSection?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Toggle sidebar", keys: ["Ctrl", "\\"] }),
        expect.objectContaining({ action: "Actual size", keys: ["Ctrl", "Shift", "9"] }),
      ]),
    );
  });

  it("does not duplicate editor view shortcuts in the notes and general sections", () => {
    const preset = getModuleShortcutPreset("notes");
    const notesSection = preset.sections.find((section) => section.title === "Notes");
    const generalSection = preset.sections.find((section) => section.title === "General");

    expect(notesSection?.shortcuts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Find in note" }),
      ]),
    );
    expect(generalSection?.shortcuts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Toggle sidebar" }),
      ]),
    );
  });

  it("localizes Typora shortcut sections and actions through the provided translator", () => {
    const translations: Record<string, string> = {
      "shortcut.title": "快捷键",
      "shortcut.description.notes": "笔记快捷键",
      "shortcut.section.paragraph": "段落",
      "shortcut.section.format": "格式",
      "shortcut.section.view": "视图",
      "shortcut.action.insertTable": "插入表格",
      "shortcut.action.clearFormatting": "清除格式",
      "shortcut.action.actualSize": "实际大小",
    };
    const preset = getModuleShortcutPreset("notes", {
      t: (key) => translations[key] ?? key,
    });

    expect(preset.sections.find((section) => section.title === "段落")?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "插入表格", keys: ["Ctrl", "T"] }),
      ]),
    );
    expect(preset.sections.find((section) => section.title === "格式")?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "清除格式", keys: ["Ctrl", "\\"] }),
      ]),
    );
    expect(preset.sections.find((section) => section.title === "视图")?.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "实际大小", keys: ["Ctrl", "Shift", "9"] }),
      ]),
    );
  });
});
