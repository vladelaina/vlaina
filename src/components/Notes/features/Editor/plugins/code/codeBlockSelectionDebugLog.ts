import { writeTextToClipboard } from '@/lib/clipboard';

type CodeBlockSelectionDebugEntry = {
  details: Record<string, unknown>;
  event: string;
  time: string;
};

const MAX_ENTRIES = 300;
const entries: CodeBlockSelectionDebugEntry[] = [];
let panel: HTMLDivElement | null = null;
let copyButton: HTMLButtonElement | null = null;
let clearButton: HTMLButtonElement | null = null;
let countLabel: HTMLSpanElement | null = null;
let resetCopyLabelTimer: number | null = null;

function getDebugText() {
  return entries
    .map((entry) => JSON.stringify(entry))
    .join('\n');
}

function updatePanelText() {
  if (!copyButton || !clearButton || !countLabel) {
    return;
  }

  copyButton.textContent = resetCopyLabelTimer === null ? 'Copy code logs' : 'Copied';
  copyButton.disabled = entries.length === 0;
  clearButton.disabled = entries.length === 0;
  countLabel.textContent = String(entries.length);
}

function ensurePanel(doc: Document) {
  if (panel?.isConnected) {
    updatePanelText();
    return;
  }

  panel = doc.createElement('div');
  panel.setAttribute('data-code-block-selection-debug-panel', 'true');
  panel.style.position = 'fixed';
  panel.style.right = '16px';
  panel.style.bottom = '72px';
  panel.style.zIndex = '2147483647';
  panel.style.display = 'flex';
  panel.style.alignItems = 'center';
  panel.style.gap = '8px';
  panel.style.padding = '8px';
  panel.style.border = '1px solid rgba(148, 163, 184, 0.45)';
  panel.style.borderRadius = '8px';
  panel.style.background = 'rgba(15, 23, 42, 0.88)';
  panel.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.22)';
  panel.style.color = '#f8fafc';
  panel.style.font = '12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  panel.style.pointerEvents = 'auto';

  countLabel = doc.createElement('span');
  countLabel.setAttribute('data-code-block-selection-debug-count', 'true');
  countLabel.style.minWidth = '24px';
  countLabel.style.textAlign = 'center';
  countLabel.style.color = '#cbd5e1';

  copyButton = doc.createElement('button');
  copyButton.type = 'button';
  copyButton.setAttribute('data-code-block-selection-debug-copy', 'true');
  copyButton.setAttribute('aria-label', 'Copy code block selection debug logs');
  copyButton.style.height = '30px';
  copyButton.style.border = '0';
  copyButton.style.borderRadius = '6px';
  copyButton.style.padding = '0 10px';
  copyButton.style.background = '#f8fafc';
  copyButton.style.color = '#0f172a';
  copyButton.style.cursor = 'pointer';
  copyButton.style.font = '600 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  copyButton.addEventListener('click', () => {
    void writeTextToClipboard(getDebugText()).then((didCopy) => {
      if (!didCopy || !copyButton) {
        return;
      }

      copyButton.textContent = 'Copied';
      const win = doc.defaultView;
      if (!win) {
        return;
      }
      if (resetCopyLabelTimer !== null) {
        win.clearTimeout(resetCopyLabelTimer);
      }
      resetCopyLabelTimer = win.setTimeout(() => {
        resetCopyLabelTimer = null;
        updatePanelText();
      }, 1200);
    });
  });

  clearButton = doc.createElement('button');
  clearButton.type = 'button';
  clearButton.setAttribute('data-code-block-selection-debug-clear', 'true');
  clearButton.setAttribute('aria-label', 'Clear code block selection debug logs');
  clearButton.style.height = '30px';
  clearButton.style.border = '1px solid rgba(248, 250, 252, 0.28)';
  clearButton.style.borderRadius = '6px';
  clearButton.style.padding = '0 10px';
  clearButton.style.background = 'transparent';
  clearButton.style.color = '#f8fafc';
  clearButton.style.cursor = 'pointer';
  clearButton.style.font = '600 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  clearButton.textContent = 'Clear logs';
  clearButton.addEventListener('click', () => {
    entries.splice(0);
    const win = doc.defaultView;
    if (win && resetCopyLabelTimer !== null) {
      win.clearTimeout(resetCopyLabelTimer);
    }
    resetCopyLabelTimer = null;
    updatePanelText();
  });

  panel.append(countLabel, copyButton, clearButton);
  doc.body.appendChild(panel);
  updatePanelText();
}

export function logCodeBlockSelectionDebug(
  doc: Document | null,
  event: string,
  details: Record<string, unknown>
) {
  if (!doc?.body) {
    return;
  }

  entries.push({
    details,
    event,
    time: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  ensurePanel(doc);
  updatePanelText();
}
