import zenumlDiagram from '@mermaid-js/mermaid-zenuml';

let mermaidInstance: any = null;
let mermaidPromise: Promise<any> | null = null;
let mermaidAvailable = true;
let mermaidCounter = 0;

type ConsoleMethodName = 'debug' | 'error' | 'info' | 'log' | 'warn';

const MERMAID_INIT_CONFIG = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  fontFamily: 'inherit',
} as const;

const CONSOLE_METHODS_TO_SUPPRESS: ConsoleMethodName[] = ['debug', 'error', 'info', 'log', 'warn'];
const suppressedConsoleMethods = new Map<ConsoleMethodName, typeof console[ConsoleMethodName]>();
let consoleSuppressionDepth = 0;

async function getMermaid() {
  if (!mermaidAvailable) return null;
  if (mermaidInstance) return mermaidInstance;

  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      try {
        const m = await import('mermaid');
        mermaidInstance = m.default;
        mermaidInstance.initialize(MERMAID_INIT_CONFIG);
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${mermaidCounter++}`;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  const mermaid = await getMermaid();

  if (!mermaid) {
    return `<div class="mermaid-error">Mermaid not available. Install with: pnpm add mermaid</div>`;
  }

  try {
    const { svg } = await withoutThirdPartyConsoleOutput<{ svg: string }>(() =>
      mermaid.render(id, code)
    );
    return svg;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `<div class="mermaid-error">Mermaid Error: ${escapeHtml(message)}</div>`;
  }
}
