import type { MouseEvent as ReactMouseEvent, MouseEventHandler } from "react";
import { openExternalUrl } from "@/lib/desktop/shell";

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const ALLOWED_LINK_PREFIX_REGEX = /^(https?:\/\/|mailto:)/i;

export function normalizeExternalHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!ALLOWED_LINK_PREFIX_REGEX.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed, window.location.href);
    if (!EXTERNAL_PROTOCOLS.has(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function openExternalHref(href: string | null | undefined): Promise<void> {
  const normalized = normalizeExternalHref(href);
  if (!normalized) {
    return;
  }

  try {
    await openExternalUrl(normalized);
    return;
  } catch {
  }

  window.open(normalized, "_blank", "noopener,noreferrer");
}

function handleExternalLinkActivation(event: ReactMouseEvent<HTMLElement>, href: string | null) {
  event.preventDefault();
  event.stopPropagation();
  if (!href) return;
  void openExternalHref(href);
}

export function getExternalLinkProps(href: string | null | undefined) {
  const safeHref = normalizeExternalHref(href);
  return {
    href: safeHref || "#",
    target: "_blank" as const,
    rel: "noopener noreferrer",
    onClick: ((event) => handleExternalLinkActivation(event, safeHref)) as MouseEventHandler<HTMLElement>,
    onAuxClick: ((event) => {
      if (event.button !== 1) return;
      handleExternalLinkActivation(event, safeHref);
    }) as MouseEventHandler<HTMLElement>,
  };
}
