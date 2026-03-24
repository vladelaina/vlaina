import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { streamdownSpy, codeBlockSpy, thinkingBlockSpy } = vi.hoisted(() => ({
  streamdownSpy: vi.fn(),
  codeBlockSpy: vi.fn(),
  thinkingBlockSpy: vi.fn(),
}));

vi.mock("streamdown", () => ({
  Streamdown: (props: any) => {
    streamdownSpy(props);
    const { components, children, parseIncompleteMarkdown, isAnimating } = props;

    return (
      <div
        data-testid="streamdown"
        data-streaming={String(parseIncompleteMarkdown)}
        data-animating={String(isAnimating)}
      >
        <div data-testid="streamdown-children">{children}</div>
        {components.p?.({ children: "inline paragraph", "data-testid": "inline-paragraph" })}
        {components.p?.({
          children: <pre data-testid="block-child">block paragraph</pre>,
          "data-testid": "block-paragraph",
        })}
        {components.pre?.({ children: <code className="language-ts">const a = 1;</code> })}
        {components.pre?.({ children: <code className="language-js">const b = 2;</code> })}
      </div>
    );
  },
  defaultRemarkPlugins: { gfm: "gfm" },
  defaultRehypePlugins: { raw: "raw" },
}));

vi.mock("./components/CodeBlock", () => ({
  CodeBlock: (props: any) => {
    codeBlockSpy(props);
    return (
      <div data-testid={`code-block-${props.blockId}`} data-copied={String(props.copied)}>
        {props.children}
      </div>
    );
  },
}));

vi.mock("@/components/Chat/features/Messages/components/ThinkingBlock", () => ({
  ThinkingBlock: (props: any) => {
    thinkingBlockSpy(props);
    return (
      <div data-testid="thinking-block" data-streaming={String(props.isStreaming)}>
        {props.content}
      </div>
    );
  },
}));

vi.mock("@/components/Chat/common/LocalImage", () => ({
  LocalImage: () => <img alt="mock" />,
}));

vi.mock("./components/ChatImageViewer", () => ({
  ChatImageViewer: () => null,
}));

import MarkdownRenderer from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  beforeEach(() => {
    streamdownSpy.mockClear();
    codeBlockSpy.mockClear();
    thinkingBlockSpy.mockClear();
  });

  it("extracts completed think blocks and renders the remaining markdown", () => {
    render(<MarkdownRenderer content={"Answer<think>reasoning</think>Done"} />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("reasoning");
    expect(screen.getByTestId("thinking-block")).toHaveAttribute("data-streaming", "false");
    expect(screen.getByTestId("streamdown-children")).toHaveTextContent("AnswerDone");
  });

  it("keeps incomplete think blocks in streaming mode and skips markdown output", () => {
    render(<MarkdownRenderer content={"<think>working"} isStreaming />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("working");
    expect(screen.getByTestId("thinking-block")).toHaveAttribute("data-streaming", "true");
    expect(screen.queryByTestId("streamdown")).not.toBeInTheDocument();
  });

  it("passes streaming flags through to streamdown", () => {
    render(<MarkdownRenderer content={"Visible"} isStreaming />);

    expect(screen.getByTestId("streamdown")).toHaveAttribute("data-streaming", "true");
    expect(screen.getByTestId("streamdown")).toHaveAttribute("data-animating", "true");
  });

  it("assigns stable code block ids and controlled copied state", () => {
    render(
      <MarkdownRenderer
        content={"```ts\nconst a = 1;\n```\n```js\nconst b = 2;\n```"}
        codeBlockIdBase="m1"
        copiedCodeBlockId="m1:1"
      />,
    );

    expect(codeBlockSpy).toHaveBeenCalledTimes(2);
    expect(codeBlockSpy.mock.calls[0][0]).toMatchObject({
      blockId: "m1:0",
      copied: false,
    });
    expect(codeBlockSpy.mock.calls[1][0]).toMatchObject({
      blockId: "m1:1",
      copied: true,
    });
  });

  it("uses div wrappers for block-level paragraph children", () => {
    render(<MarkdownRenderer content={"Visible"} />);

    expect(screen.getByTestId("inline-paragraph").tagName).toBe("P");
    expect(screen.getByTestId("block-paragraph").tagName).toBe("DIV");
  });
});
