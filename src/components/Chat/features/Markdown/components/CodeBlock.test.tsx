import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getLanguage: vi.fn(),
  highlight: vi.fn(),
  highlightAuto: vi.fn(),
}));

vi.mock("../utils/chatHighlighter", () => ({
  chatHighlighter: {
    getLanguage: mocks.getLanguage,
    highlight: mocks.highlight,
    highlightAuto: mocks.highlightAuto,
  },
}));

vi.mock("@/components/Chat/common/CopyButton", () => ({
  default: ({ content }: { content: string }) => (
    <button data-testid="copy-button" data-content={content}>
      copy
    </button>
  ),
}));

import { CodeBlock } from "./CodeBlock";

describe("CodeBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLanguage.mockReturnValue(true);
    mocks.highlight.mockReturnValue({ value: "<span>highlighted</span>" });
    mocks.highlightAuto.mockReturnValue({ value: "<span>auto</span>" });
  });

  it("highlights immediately when a code block is renderable", () => {
    render(
      <CodeBlock className="language-ts">
        {"const v = 1;"}
      </CodeBlock>,
    );

    expect(mocks.highlight).toHaveBeenCalledWith("const v = 1;", {
      language: "ts",
    });
    expect(mocks.highlightAuto).not.toHaveBeenCalled();
    expect(screen.getByTestId("copy-button")).toHaveAttribute("data-content", "const v = 1;");
  });

  it("uses language-specific highlighting when language is known", () => {
    render(
      <CodeBlock className="language-ts">
        {"const v = 1;"}
      </CodeBlock>,
    );

    expect(mocks.getLanguage).toHaveBeenCalledWith("ts");
    expect(mocks.highlight).toHaveBeenCalledWith("const v = 1;", {
      language: "ts",
    });
    expect(mocks.highlightAuto).not.toHaveBeenCalled();
  });

  it("falls back to auto-highlight when language is unknown", () => {
    mocks.getLanguage.mockReturnValue(false);

    render(
      <CodeBlock className="language-unknown">
        {"just text"}
      </CodeBlock>,
    );

    expect(mocks.highlight).not.toHaveBeenCalled();
    expect(mocks.highlightAuto).toHaveBeenCalledWith("just text");
  });

  it("memoizes highlighting for identical rerenders and recomputes only on content change", () => {
    const { rerender } = render(
      <CodeBlock className="language-ts">
        {"const a = 1;"}
      </CodeBlock>,
    );

    expect(mocks.highlight).toHaveBeenCalledTimes(1);

    rerender(
      <CodeBlock className="language-ts">
        {"const a = 1;"}
      </CodeBlock>,
    );
    expect(mocks.highlight).toHaveBeenCalledTimes(1);

    rerender(
      <CodeBlock className="language-ts">
        {"const a = 2;"}
      </CodeBlock>,
    );
    expect(mocks.highlight).toHaveBeenCalledTimes(2);
  });
});
