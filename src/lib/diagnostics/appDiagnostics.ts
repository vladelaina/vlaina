type DiagnosticPayload = Record<string, unknown>;

export type DiagnosticEntry = {
  at: string;
  area: string;
  event: string;
  payload?: DiagnosticPayload;
};

const MAX_DIAGNOSTIC_ENTRIES = 400;
const entries: DiagnosticEntry[] = [];

function normalizePayload(payload: DiagnosticPayload | undefined): DiagnosticPayload | undefined {
  if (!payload) return undefined;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (value instanceof Error) {
        return [key, {
          name: value.name,
          message: value.message,
          stack: value.stack,
        }];
      }
      return [key, value];
    }),
  );
}

export function recordDiagnostic(area: string, event: string, payload?: DiagnosticPayload): void {
  entries.push({
    at: new Date().toISOString(),
    area,
    event,
    payload: normalizePayload(payload),
  });

  if (entries.length > MAX_DIAGNOSTIC_ENTRIES) {
    entries.splice(0, entries.length - MAX_DIAGNOSTIC_ENTRIES);
  }
}

export function formatDiagnosticLog(): string {
  const header = [
    'vlaina diagnostics',
    `generatedAt=${new Date().toISOString()}`,
    `url=${typeof window === 'undefined' ? 'unknown' : window.location.href}`,
    `userAgent=${typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent}`,
    `entries=${entries.length}`,
  ];
  const body = entries.map((entry) => JSON.stringify(entry));
  return [...header, '', ...body].join('\n');
}
