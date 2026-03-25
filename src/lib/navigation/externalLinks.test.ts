import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";

const { safeInvokeMock, isTauriMock } = vi.hoisted(() => ({
  safeInvokeMock: vi.fn(),
  isTauriMock: vi.fn(() => false),
}));

vi.mock("@/lib/tauri/invoke", () => ({
  safeInvoke: safeInvokeMock,
}));

vi.mock("@/lib/storage/adapter", () => ({
  isTauri: isTauriMock,
}));

import {
  normalizeExternalHref,
  openExternalHref,
  getExternalLinkProps,
} from "./externalLinks";

describe("externalLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(false);
  });

  describe("normalizeExternalHref", () => {
    it("accepts only external-safe protocols", () => {
      expect(normalizeExternalHref("https://example.com")).toBe(
        "https://example.com/",
      );
      expect(normalizeExternalHref("http://example.com/path?a=1")).toBe(
        "http://example.com/path?a=1",
      );
      expect(normalizeExternalHref("mailto:hello@example.com")).toBe(
        "mailto:hello@example.com",
      );
    });

    it("rejects non-external or unsafe protocols", () => {
      expect(normalizeExternalHref("javascript:alert(1)")).toBeNull();
      expect(normalizeExternalHref("data:text/html;base64,Zm9v")).toBeNull();
      expect(normalizeExternalHref("/internal/path")).toBeNull();
      expect(normalizeExternalHref("ftp://example.com")).toBeNull();
      expect(normalizeExternalHref("   ")).toBeNull();
    });

    it("never accepts non-http(s)/mailto prefixes for random strings", () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const lower = input.trim().toLowerCase();
          const hasAllowedPrefix =
            lower.startsWith("http://") ||
            lower.startsWith("https://") ||
            lower.startsWith("mailto:");
          if (!hasAllowedPrefix) {
            expect(normalizeExternalHref(input)).toBeNull();
          }
        }),
        { numRuns: 120 },
      );
    });
  });

  describe("openExternalHref", () => {
    it("uses tauri command for valid desktop URLs", async () => {
      isTauriMock.mockReturnValue(true);
      safeInvokeMock.mockResolvedValue(undefined);

      await openExternalHref("https://example.com/docs");

      expect(safeInvokeMock).toHaveBeenCalledTimes(1);
      expect(safeInvokeMock).toHaveBeenCalledWith(
        "open_external_url",
        { url: "https://example.com/docs" },
        { throwOnWeb: true },
      );
    });

    it("falls back to window.open when desktop command fails", async () => {
      isTauriMock.mockReturnValue(true);
      safeInvokeMock.mockRejectedValue(new Error("command unavailable"));
      const windowOpenSpy = vi
        .spyOn(window, "open")
        .mockImplementation(() => null as any);

      await openExternalHref("https://example.com/fallback");

      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://example.com/fallback",
        "_blank",
        "noopener,noreferrer",
      );

      windowOpenSpy.mockRestore();
    });

    it("does nothing for invalid input and avoids desktop command", async () => {
      isTauriMock.mockReturnValue(true);
      await openExternalHref("javascript:alert(1)");
      expect(safeInvokeMock).not.toHaveBeenCalled();
    });
  });

  describe("getExternalLinkProps", () => {
    it("returns safe anchor defaults for invalid href", () => {
      const props = getExternalLinkProps("javascript:alert(1)");
      expect(props.href).toBe("#");
      expect(props.target).toBe("_blank");
      expect(props.rel).toBe("noopener noreferrer");
    });

    it("returns normalized href for valid input", () => {
      const props = getExternalLinkProps("https://example.com");
      expect(props.href).toBe("https://example.com/");
    });

    it("click handlers always prevent default bubbling", () => {
      const props = getExternalLinkProps("https://example.com");
      const event = {
        button: 0,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      props.onClick(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    });

    it("aux-click handler only intercepts middle click", () => {
      const props = getExternalLinkProps("https://example.com");
      const leftEvent = {
        button: 0,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;
      const middleEvent = {
        button: 1,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      props.onAuxClick(leftEvent);
      props.onAuxClick(middleEvent);

      expect(leftEvent.preventDefault).not.toHaveBeenCalled();
      expect(leftEvent.stopPropagation).not.toHaveBeenCalled();
      expect(middleEvent.preventDefault).toHaveBeenCalledTimes(1);
      expect(middleEvent.stopPropagation).toHaveBeenCalledTimes(1);
    });
  });
});
