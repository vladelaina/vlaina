import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { measureRichInlineStats } from "@/lib/text-layout";
import {
  getPreparedMarkdownTextBlock,
  normalizeInlineMarkdownForMeasurement,
} from "@/components/Chat/features/Layout/chatAssistantInlineMarkdown";
import { buildChatStreamSchedule, useChatStreamBlocks } from "./chatStreamTextAnimation";

const { reactMarkdownSpy, codeBlockSpy, thinkingBlockSpy } = vi.hoisted(() => ({
  reactMarkdownSpy: vi.fn(),
  codeBlockSpy: vi.fn(),
  thinkingBlockSpy: vi.fn(),
}));

vi.mock("react-markdown", () => ({
  default: (props: any) => {
    reactMarkdownSpy(props);
    const { components, children, remarkPlugins, rehypePlugins } = props;

    return (
      <div
        data-testid="react-markdown"
        data-remark-count={String(remarkPlugins.length)}
        data-rehype-count={String(rehypePlugins.length)}
      >
        <div data-testid="markdown-children">{children}</div>
        {components.p?.({ children: "inline paragraph", "data-testid": "inline-paragraph" })}
        {components.a?.({ href: "https://example.com", children: "link", "data-testid": "inline-link" })}
        {components.p?.({
          children: <pre data-testid="block-child">block paragraph</pre>,
          "data-testid": "block-paragraph",
        })}
        {components.pre?.({ children: <code className="language-ts">const a = 1;</code> })}
        {components.pre?.({ children: <code className="language-js">const b = 2;</code> })}
      </div>
    );
  },
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
import { clearNotesDebugLog } from "@/stores/notes/lineBreakDebugLog";

describe("MarkdownRenderer", () => {
  beforeEach(() => {
    reactMarkdownSpy.mockClear();
    codeBlockSpy.mockClear();
    thinkingBlockSpy.mockClear();
    clearNotesDebugLog();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearNotesDebugLog();
  });

  it("extracts completed think blocks and renders the remaining markdown", () => {
    render(<MarkdownRenderer content={"Answer<think>reasoning</think>Done"} />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("reasoning");
    expect(screen.getByTestId("thinking-block")).toHaveAttribute("data-streaming", "false");
    expect(screen.getByTestId("markdown-children")).toHaveTextContent("AnswerDone");
  });

  it("extracts multiple completed think blocks without leaking them into markdown", () => {
    render(<MarkdownRenderer content={"A<think>first</think>B<think>second</think>C"} />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("first");
    expect(screen.getByTestId("thinking-block")).toHaveTextContent("second");
    expect(screen.getByTestId("markdown-children")).toHaveTextContent("ABC");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("second");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("<think>");
  });

  it("keeps incomplete think blocks streaming and skips markdown output", () => {
    render(<MarkdownRenderer content={"<think>working"} />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("working");
    expect(screen.getByTestId("thinking-block")).toHaveAttribute("data-streaming", "false");
    expect(screen.queryByTestId("react-markdown")).not.toBeInTheDocument();
  });

  it("keeps incomplete think blocks active while the message is still streaming", () => {
    render(<MarkdownRenderer content={"<think>working"} isStreaming />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("working");
    expect(screen.getByTestId("thinking-block")).toHaveAttribute("data-streaming", "true");
    expect(screen.queryByTestId("react-markdown")).not.toBeInTheDocument();
  });

  it("passes the stream start time into live thinking blocks", () => {
    const startTime = new Date("2026-05-11T06:00:00.000Z");

    render(<MarkdownRenderer content={"<think>working"} isStreaming startTime={startTime} />);

    expect(thinkingBlockSpy.mock.calls[0][0]).toMatchObject({
      startTime,
    });
  });

  it("does not leak a partial opening think tag into streaming markdown", () => {
    render(<MarkdownRenderer content={"Visible<thi"} isStreaming />);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("<thi");
    expect(screen.queryByTestId("thinking-block")).not.toBeInTheDocument();
  });

  it("does not show a partial closing think tag inside live thinking", () => {
    render(<MarkdownRenderer content={"<think>working</thi"} isStreaming />);

    expect(screen.getByTestId("thinking-block")).toHaveTextContent("working");
    expect(screen.getByTestId("thinking-block")).not.toHaveTextContent("</thi");
    expect(screen.getByTestId("thinking-block")).toHaveAttribute("data-streaming", "true");
    expect(screen.queryByTestId("react-markdown")).not.toBeInTheDocument();
  });

  it("renders markdown through the local react-markdown pipeline", () => {
    render(<MarkdownRenderer content={"Visible"} />);

    expect(screen.getByTestId("react-markdown")).toHaveAttribute("data-remark-count", "3");
    expect(screen.getByTestId("react-markdown")).toHaveAttribute("data-rehype-count", "3");
    expect(screen.getByTestId("react-markdown").parentElement).toHaveClass("vlaina-markdown-surface");
  });

  it("marks visible streaming markdown for the live transition layer", () => {
    render(<MarkdownRenderer content={"Visible"} isStreaming />);

    const surface = screen.getByTestId("react-markdown").parentElement;
    expect(surface).toHaveAttribute("data-chat-markdown-live", "true");
    expect(surface).toHaveClass("chat-markdown-live");
  });

  it("keeps the visible stream on the markdown surface", async () => {
    vi.useFakeTimers();

    render(<MarkdownRenderer content={"Visible"} isStreaming imageIdBase="m1" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });

    expect(screen.getByTestId("react-markdown").parentElement).toHaveAttribute("data-chat-markdown-live", "true");
  });

  it("reflows the streaming schedule by visual line width", () => {
    const text = "A longer assistant paragraph that should wrap differently when width changes.";
    const prepared = getPreparedMarkdownTextBlock(text, "body");

    const wide = measureRichInlineStats(prepared, 520).lineCount;
    const narrow = measureRichInlineStats(prepared, 260).lineCount;

    expect(narrow).toBeGreaterThan(wide);
  });

  it("schedules a wrapped paragraph as a single visual stream", () => {
    const longParagraph = "word ".repeat(80);

    const blocks = buildChatStreamSchedule(longParagraph, 260, 1000);
    expect(blocks.births.length).toBe(Array.from(normalizeInlineMarkdownForMeasurement(longParagraph)).length);
    expect(blocks.births.slice(1).every((birth: number, index: number) => birth >= blocks.births[index]!)).toBe(true);
  });

  it("builds a fallback stream schedule before measurement", () => {
    const blocks = buildChatStreamSchedule("Visible", 0, 1000);

    expect(blocks.births).toHaveLength(Array.from("Visible").length);
    expect(blocks.revealed).toBe(false);
  });

  it("anchors streaming animation to the message start time across remounts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T06:00:02.000Z"));
    const performanceNowSpy = vi.spyOn(performance, "now").mockReturnValue(2000);
    const streamStartTime = new Date("2026-05-11T06:00:00.000Z");

    const firstRender = renderHook(() =>
      useChatStreamBlocks("Visible", true, 0, streamStartTime, true),
    );
    const firstBlock = firstRender.result.current[0]!;
    expect(firstBlock.revealed).toBe(true);
    firstRender.unmount();

    performanceNowSpy.mockReturnValue(3500);
    vi.setSystemTime(new Date("2026-05-11T06:00:03.500Z"));
    const secondRender = renderHook(() =>
      useChatStreamBlocks("Visible", true, 0, streamStartTime, true),
    );
    const secondBlock = secondRender.result.current[0]!;
    expect(secondBlock.revealed).toBe(true);
    expect(secondBlock.births[0]).toBeCloseTo(firstBlock.births[0]!);
    secondRender.unmount();
    performanceNowSpy.mockRestore();
  });

  it("schedules heading text before following paragraph text", () => {
    const blocks = buildChatStreamSchedule("# Title\n\nBody", 0, 1000);
    const titleLength = Array.from("Title").length;

    expect(blocks.births).toHaveLength(titleLength + Array.from("Body").length);
    expect(blocks.births[0]).toBeLessThan(blocks.births[titleLength]!);
    expect(blocks.births[titleLength - 1]).toBeLessThan(blocks.births[titleLength]!);
  });

  it("freezes streaming markdown on pointer down while preserving the live selection DOM", () => {
    const { rerender } = render(<MarkdownRenderer content={"Visible"} isStreaming />);

    const surface = screen.getByTestId("react-markdown").parentElement!;
    fireEvent.pointerDown(surface, { button: 0 });
    rerender(<MarkdownRenderer content={"Visible plus more"} isStreaming />);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("Visible plus more");
    expect(screen.getByTestId("react-markdown").parentElement).toHaveAttribute("data-chat-markdown-live", "true");
    expect(screen.getByTestId("react-markdown").parentElement).toHaveClass("chat-markdown-live");
  });

  it("pauses the streaming animation clock while markdown selection is frozen", () => {
    vi.useFakeTimers();
    const { rerender } = render(<MarkdownRenderer content={"Visible"} isStreaming />);

    const surface = screen.getByTestId("react-markdown").parentElement!;
    fireEvent.pointerDown(surface, { button: 0 });
    rerender(<MarkdownRenderer content={"Visible plus more"} isStreaming />);

    reactMarkdownSpy.mockClear();
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(reactMarkdownSpy).not.toHaveBeenCalled();
  });

  it("does not rerender markdown on pointer down selection start", () => {
    render(<MarkdownRenderer content={"Visible"} isStreaming />);

    reactMarkdownSpy.mockClear();
    fireEvent.pointerDown(screen.getByTestId("react-markdown").parentElement!, { button: 0 });

    expect(reactMarkdownSpy).not.toHaveBeenCalled();
  });

  it("does not rerender markdown on mouse down selection start", () => {
    render(<MarkdownRenderer content={"Visible"} isStreaming />);

    reactMarkdownSpy.mockClear();
    fireEvent.mouseDown(screen.getByTestId("react-markdown").parentElement!, { button: 0 });

    expect(reactMarkdownSpy).not.toHaveBeenCalled();
  });

  it("does not freeze streaming markdown when interactive content is clicked", () => {
    const { rerender } = render(<MarkdownRenderer content={"Visible"} isStreaming />);

    fireEvent.pointerDown(screen.getByTestId("inline-link"), { button: 0 });
    rerender(<MarkdownRenderer content={"Visible plus more"} isStreaming />);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible plus more");
    expect(screen.getByTestId("react-markdown").parentElement).toHaveAttribute("data-chat-markdown-live", "true");
  });

  it("keeps streaming markdown frozen while a completed selection remains active", () => {
    vi.useFakeTimers();
    let selectedText = "Visible";
    const selectionSpy = vi.spyOn(window, "getSelection").mockReturnValue({
      get isCollapsed() {
        return selectedText.length === 0;
      },
      rangeCount: 1,
      toString: () => selectedText,
    } as Selection);
    const { rerender } = render(<MarkdownRenderer content={"Visible"} isStreaming />);

    const surface = screen.getByTestId("react-markdown").parentElement!;
    fireEvent.mouseDown(surface, { button: 0 });
    rerender(<MarkdownRenderer content={"Visible plus more"} isStreaming />);
    fireEvent.pointerUp(document);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("Visible plus more");

    act(() => {
      vi.advanceTimersByTime(701);
    });
    rerender(<MarkdownRenderer content={"Visible plus more and more"} isStreaming />);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("Visible plus more and more");

    selectedText = "";
    fireEvent(document, new Event("selectionchange"));
    act(() => {
      vi.advanceTimersByTime(121);
    });
    rerender(<MarkdownRenderer content={"Visible plus more and more"} isStreaming />);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible plus more and more");
    selectionSpy.mockRestore();
  });

  it("freezes streaming markdown content while stream animation is suspended", () => {
    const { rerender } = render(<MarkdownRenderer content={"Visible"} isStreaming />);

    rerender(
      <MarkdownRenderer
        content={"Visible plus more"}
        isStreaming
        suspendStreamAnimation
      />,
    );

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible plus more");

    rerender(
      <MarkdownRenderer
        content={"Visible plus more and more"}
        isStreaming
        suspendStreamAnimation
      />,
    );

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible plus more");
    expect(screen.getByTestId("markdown-children")).not.toHaveTextContent("Visible plus more and more");

    rerender(<MarkdownRenderer content={"Visible plus more and more"} isStreaming />);

    expect(screen.getByTestId("markdown-children")).toHaveTextContent("Visible plus more and more");
  });

  it("assigns stable code block ids and controlled copied state", () => {
    const { rerender } = render(
      <MarkdownRenderer
        content={"```ts\nconst a = 1;\n```\n```js\nconst b = 2;\n```"}
        codeBlockIdBase="m1"
        copiedCodeBlockId="m1:1"
      />,
    );

    codeBlockSpy.mockClear();

    rerender(
      <MarkdownRenderer
        content={"Intro\n```ts\nconst a = 1;\n```\n```js\nconst b = 2;\n```"}
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
