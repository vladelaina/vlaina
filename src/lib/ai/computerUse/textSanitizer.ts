const ANSI_ESCAPE_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const UNSAFE_TERMINAL_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\p{Cf}\p{Zl}\p{Zp}\uFFFD]/gu;

export function sanitizeComputerCommandText(value: unknown, maxChars: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(UNSAFE_TERMINAL_CONTROLS, '')
    .slice(-maxChars);
}
