import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorBlock } from "./ErrorBlock";

describe("ErrorBlock", () => {
  it("marks readable error text as a chat selection surface", () => {
    render(<ErrorBlock content="My brain needs a breather. Try again in a moment." />);

    expect(screen.getByText("My brain needs a breather. Try again in a moment."))
      .toHaveAttribute("data-chat-selection-surface", "true");
    expect(screen.getByText("My brain needs a breather. Try again in a moment."))
      .toHaveAttribute("data-chat-selection-start", "true");
  });
});
