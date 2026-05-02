import { describe, expect, it } from "vitest";
import {
  canStartChatSelection,
  isInsideAssistantMessageItem,
  isInsideSelectionExcluded,
  isInsideSelectionSurface,
  resolveOutsideMoveDecision,
} from "./chatSelectionBehavior";

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

describe("chat selection surfaces", () => {
  it("starts only from assistant message content surfaces", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-message-item="true" data-role="assistant">
        <div data-testid="assistant-title" data-chat-selection-excluded="true">Reasoning</div>
        <div data-testid="assistant-body" data-chat-selection-surface="true">Answer</div>
      </div>
      <div data-message-item="true" data-role="user">
        <div data-testid="user-bubble" data-chat-selection-surface="true">Question</div>
      </div>
    `;
    document.body.appendChild(container);

    const assistantTitle = container.querySelector('[data-testid="assistant-title"]');
    const assistantBody = container.querySelector('[data-testid="assistant-body"]');
    const userBubble = container.querySelector('[data-testid="user-bubble"]');

    expect(canStartChatSelection(assistantBody)).toBe(true);
    expect(canStartChatSelection(assistantTitle)).toBe(false);
    expect(canStartChatSelection(userBubble)).toBe(false);
    expect(isInsideSelectionExcluded(assistantTitle)).toBe(true);

    container.remove();
  });

  it("allows user bubbles as extension surfaces after selection has started", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-message-item="true" data-role="assistant">
        <div data-testid="assistant-body" data-chat-selection-surface="true">Answer</div>
      </div>
      <div data-message-item="true" data-role="user">
        <div data-testid="user-bubble" data-chat-selection-surface="true">Question</div>
      </div>
      <div data-testid="gap"></div>
    `;
    document.body.appendChild(container);

    const assistantBody = container.querySelector('[data-testid="assistant-body"]');
    const userBubble = container.querySelector('[data-testid="user-bubble"]');
    const gap = container.querySelector('[data-testid="gap"]');

    expect(isInsideAssistantMessageItem(assistantBody)).toBe(true);
    expect(isInsideSelectionSurface(assistantBody)).toBe(true);
    expect(isInsideSelectionSurface(userBubble)).toBe(true);
    expect(isInsideSelectionSurface(gap)).toBe(false);

    container.remove();
  });

  it("does not start from controls inside assistant content surfaces", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-message-item="true" data-role="assistant">
        <div data-chat-selection-surface="true">
          <p data-testid="assistant-text">Answer</p>
          <button data-testid="copy-button">Copy</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const assistantText = container.querySelector('[data-testid="assistant-text"]');
    const copyButton = container.querySelector('[data-testid="copy-button"]');

    expect(canStartChatSelection(assistantText)).toBe(true);
    expect(isInsideSelectionSurface(copyButton)).toBe(false);
    expect(isInsideSelectionExcluded(copyButton)).toBe(true);
    expect(canStartChatSelection(copyButton)).toBe(false);

    container.remove();
  });
});
