import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBlock } from "./ErrorBlock";
import { ACCOUNT_LOGIN_REQUESTED_EVENT } from "@/lib/account/sessionEvent";

describe("ErrorBlock", () => {
  it("marks readable error text as a chat selection surface", () => {
    render(<ErrorBlock content="My brain needs a breather. Try again in a moment." />);

    expect(screen.getByText("My brain needs a breather. Try again in a moment."))
      .toHaveAttribute("data-chat-selection-surface", "true");
    expect(screen.getByText("My brain needs a breather. Try again in a moment."))
      .toHaveAttribute("data-chat-selection-start", "true");
  });

  it("links public HTTP URLs in readable error text", () => {
    render(<ErrorBlock content="Read https://example.com/docs then retry." />);

    expect(screen.getByRole("link", { name: "https://example.com/docs" }))
      .toHaveAttribute("href", "https://example.com/docs");
  });

  it("does not link local-network HTTP URLs in readable error text", () => {
    render(
      <ErrorBlock content="Blocked http://localhost:3000/admin http://2130706433/admin http://[::1]/admin. Read https://example.com/docs" />,
    );

    expect(screen.getByText(/http:\/\/localhost:3000\/admin/)).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/2130706433\/admin/)).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/\[::1\]\/admin/)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "https://example.com/docs" }))
      .toHaveAttribute("href", "https://example.com/docs");
  });

  it("caps linked URLs in readable error text", () => {
    render(
      <ErrorBlock
        content={Array.from({ length: 60 }, (_, index) => `https://example.com/${index}`).join(" ")}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(50);
    expect(screen.getByText(/https:\/\/example.com\/59/)).toBeInTheDocument();
  });

  it("renders a sign-in prompt that opens the account login flow", () => {
    const onLoginRequested = vi.fn();
    window.addEventListener(ACCOUNT_LOGIN_REQUESTED_EVENT, onLoginRequested);

    try {
      render(<ErrorBlock content="Sign in required." showLoginPrompt />);
      fireEvent.click(screen.getByRole("button"));
    } finally {
      window.removeEventListener(ACCOUNT_LOGIN_REQUESTED_EVENT, onLoginRequested);
    }

    expect(onLoginRequested).toHaveBeenCalledTimes(1);
  });
});
