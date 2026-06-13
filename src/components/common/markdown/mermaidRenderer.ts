import zenumlDiagram from '@mermaid-js/mermaid-zenuml';
import { translate } from '@/lib/i18n';
import { createDefaultMermaidThemeConfig } from '@/lib/notes/mermaid/mermaidTheme';

let mermaidInstance: any = null;
let mermaidPromise: Promise<any> | null = null;
let mermaidAvailable = true;
let mermaidCounter = 0;

type ConsoleMethodName = 'debug' | 'error' | 'info' | 'log' | 'warn';

export const MAX_MERMAID_CODE_CHARS = 20_000;
export const MERMAID_RENDER_TIMEOUT_MS = 5000;
const MERMAID_INIT_CONFIG = {
  startOnLoad: false,
  securityLevel: 'strict',
  fontFamily: 'inherit',
  flowchart: {
    htmlLabels: false,
  },
} as const;

const CONSOLE_METHODS_TO_SUPPRESS: ConsoleMethodName[] = ['debug', 'error', 'info', 'log', 'warn'];
const suppressedConsoleMethods = new Map<ConsoleMethodName, typeof console[ConsoleMethodName]>();
let consoleSuppressionDepth = 0;

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function mermaidRenderErrorMarkup(): string {
  return `<div class="mermaid-error">${escapeHtmlText(translate('editor.mermaidRenderError'))}</div>`;
}

async function getMermaid() {
  if (!mermaidAvailable) return null;
  if (mermaidInstance) return mermaidInstance;

  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      try {
        const m = await import('mermaid');
        mermaidInstance = m.default;
        mermaidInstance.initialize(createMermaidRenderConfig());
        await mermaidInstance.registerExternalDiagrams([zenumlDiagram]);
        return mermaidInstance;
      } catch {
        mermaidAvailable = false;
        return null;
      }
    })();
  }

  return mermaidPromise;
}

export function prewarmMermaidRenderer() {
  void getMermaid().catch(() => undefined);
}

function createMermaidRenderConfig() {
  return {
    ...MERMAID_INIT_CONFIG,
    ...createDefaultMermaidThemeConfig(),
  };
}

async function withoutThirdPartyConsoleOutput<T>(action: () => Promise<T>): Promise<T> {
  if (consoleSuppressionDepth === 0) {
    for (const method of CONSOLE_METHODS_TO_SUPPRESS) {
      suppressedConsoleMethods.set(method, console[method]);
      console[method] = () => undefined;
    }
  }
  consoleSuppressionDepth += 1;

  try {
    return await action();
  } finally {
    consoleSuppressionDepth -= 1;
    if (consoleSuppressionDepth === 0) {
      for (const [method, originalMethod] of suppressedConsoleMethods) {
        console[method] = originalMethod;
      }
      suppressedConsoleMethods.clear();
    }
  }
}

function runWithTimeout<T>(action: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error('Mermaid render timed out.')));
    }, timeoutMs);

    Promise.resolve()
      .then(action)
      .then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
  });
}

export function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${mermaidCounter++}`;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  if (code.length > MAX_MERMAID_CODE_CHARS) {
    return '<div class="mermaid-error">Mermaid Error: Diagram is too large to render.</div>';
  }

  const mermaid = await getMermaid();

  if (!mermaid) {
    return `<div class="mermaid-error">${escapeHtmlText(translate('editor.mermaidNotAvailable'))}</div>`;
  }

  try {
    mermaid.initialize(createMermaidRenderConfig());
    const { svg } = await withoutThirdPartyConsoleOutput<{ svg: string }>(() =>
      runWithTimeout(() => mermaid.render(id, code), MERMAID_RENDER_TIMEOUT_MS)
    );
    return normalizeMermaidRenderMarkup(svg);
  } catch {
    return mermaidRenderErrorMarkup();
  }
}

export function normalizeMermaidRenderMarkup(markup: string): string {
  return isMermaidSyntaxErrorMarkup(markup) ? mermaidRenderErrorMarkup() : markup;
}

function isMermaidSyntaxErrorMarkup(markup: string): boolean {
  return /class=(["'])error-(?:text|icon)\1/.test(markup)
    || markup.includes('Syntax error in text');
}
