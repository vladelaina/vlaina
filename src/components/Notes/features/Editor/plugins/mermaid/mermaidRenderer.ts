let mermaidInstance: any = null;
let mermaidPromise: Promise<any> | null = null;
let mermaidAvailable = true;
let mermaidCounter = 0;

const MERMAID_INIT_CONFIG = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  fontFamily: 'inherit',
} as const;

async function getMermaid() {
  if (!mermaidAvailable) return null;
  if (mermaidInstance) return mermaidInstance;

  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      try {
        const m = await import('mermaid');
        mermaidInstance = m.default;
        mermaidInstance.initialize(MERMAID_INIT_CONFIG);
        return mermaidInstance;
      } catch {
        mermaidAvailable = false;
        return null;
      }
    })();
  }

  return mermaidPromise;
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
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `<div class="mermaid-error">Mermaid Error: ${escapeHtml(message)}</div>`;
  }
}
