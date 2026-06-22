import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { useUnifiedStore } from "@/stores/unified/useUnifiedStore";

const mocks = vi.hoisted(() => ({
  getLanguage: vi.fn(),
  highlight: vi.fn(),
  highlightAuto: vi.fn(),
}));

vi.mock("@/components/common/code-block/highlighter", () => ({
  markdownHighlighter: {
    getLanguage: mocks.getLanguage,
    highlight: mocks.highlight,
    highlightAuto: mocks.highlightAuto,
  },
  chatHighlighter: {
    getLanguage: mocks.getLanguage,
    highlight: mocks.highlight,
    highlightAuto: mocks.highlightAuto,
  },
}));

import { CodeBlock } from "./CodeBlock";

function setCodeBlockLineNumbers(showLineNumbers: boolean) {
  useUnifiedStore.setState((state) => ({
    data: {
      ...state.data,
      settings: {
        ...state.data.settings,
        markdown: {
          ...DEFAULT_SETTINGS.markdown,
          ...state.data.settings.markdown,
          codeBlock: {
            ...DEFAULT_SETTINGS.markdown.codeBlock,
            ...state.data.settings.markdown?.codeBlock,
            showLineNumbers,
          },
        },
      },
    },
  }));
}

describe("CodeBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCodeBlockLineNumbers(true);
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
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("shows line numbers from the shared markdown code block setting", () => {
    const { container } = render(
      <CodeBlock className="language-ts">
        {"const a = 1;\nconst b = 2;"}
      </CodeBlock>,
    );

    expect(container.querySelector(".code-block-chrome-line-numbers")?.textContent).toBe("1\n2");
  });

  it("hides line numbers when the shared markdown code block setting is disabled", () => {
    setCodeBlockLineNumbers(false);

    const { container } = render(
      <CodeBlock className="language-ts">
        {"const a = 1;\nconst b = 2;"}
      </CodeBlock>,
    );

    expect(container.querySelector(".code-block-chrome-line-numbers")).toBeNull();
  });

  it("skips line number generation for pathological code block line counts", () => {
    const largeLineCode = Array.from({ length: 20_002 }, () => "x").join("\n");

    const { container } = render(
      <CodeBlock className="language-ts">
        {largeLineCode}
      </CodeBlock>,
    );

    expect(container.querySelector(".code-block-chrome-line-numbers")).toBeNull();
    expect(mocks.highlight).not.toHaveBeenCalled();
    expect(mocks.highlightAuto).not.toHaveBeenCalled();
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

  it("skips auto-highlight for large unknown code blocks", () => {
    mocks.getLanguage.mockReturnValue(false);
    const largeCode = `<script>${"x".repeat(20_001)}</script>`;

    const { container } = render(
      <CodeBlock className="language-unknown">
        {largeCode}
      </CodeBlock>,
    );

    expect(mocks.highlight).not.toHaveBeenCalled();
    expect(mocks.highlightAuto).not.toHaveBeenCalled();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe(largeCode);
  });

  it("skips language-specific highlighting for large known code blocks", () => {
    const largeCode = `<script>${"x".repeat(20_001)}</script>`;

    const { container } = render(
      <CodeBlock className="language-ts">
        {largeCode}
      </CodeBlock>,
    );

    expect(mocks.getLanguage).not.toHaveBeenCalled();
    expect(mocks.highlight).not.toHaveBeenCalled();
    expect(mocks.highlightAuto).not.toHaveBeenCalled();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe(largeCode);
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
