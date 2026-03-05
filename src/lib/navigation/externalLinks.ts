import type { MouseEventHandler } from "react";

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
    if (!EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function openExternalHref(href: string | null | undefined): Promise<void> {
  const normalized = normalizeExternalHref(href);
  if (!normalized) return;

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(normalized);
  } catch {
    window.open(normalized, "_blank", "noopener,noreferrer");
  }
}

function handleExternalLinkActivation(
  event: Parameters<MouseEventHandler<HTMLElement>>[0],
  href: string | null,
): void {
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
