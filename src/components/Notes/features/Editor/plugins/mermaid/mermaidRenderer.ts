import zenumlDiagram from '@mermaid-js/mermaid-zenuml';
import { createDefaultMermaidThemeConfig } from '@/lib/notes/mermaid/mermaidTheme';

let mermaidInstance: any = null;
let mermaidPromise: Promise<any> | null = null;
let mermaidAvailable = true;
let mermaidCounter = 0;

type ConsoleMethodName = 'debug' | 'error' | 'info' | 'log' | 'warn';

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

export function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${mermaidCounter++}`;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
  const mermaid = await getMermaid();

  if (!mermaid) {
    return `<div class="mermaid-error">Mermaid not available. Install with: pnpm add mermaid</div>`;
  }

  try {
    mermaid.initialize(createMermaidRenderConfig());
    const { svg } = await withoutThirdPartyConsoleOutput<{ svg: string }>(() =>
      mermaid.render(id, code)
    );
    return svg;
  } catch {
    return '<div class="mermaid-error">Mermaid Error: Unable to render diagram. Check the diagram syntax.</div>';
  }
}
