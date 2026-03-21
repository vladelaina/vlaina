import { describe, expect, it } from 'vitest';
import { isValidLatex, parseMathRenderError, renderLatex } from './katex';

describe('katex utils', () => {
  it('renders placeholders for empty inline and block latex', () => {
    expect(renderLatex('', false)).toEqual({
      html: '<span class="math-placeholder">formula</span>',
      error: null,
      errorDetails: null,
    });
    expect(renderLatex('   ', true)).toEqual({
      html: '<span class="math-placeholder">Equation</span>',
      error: null,
      errorDetails: null,
    });
  });

  it('renders valid latex without an error', () => {
    const result = renderLatex('x^2 + y^2', false);

    expect(result.error).toBeNull();
    expect(result.html).toContain('katex');
  });

  it('supports configured macros during rendering', () => {
    const result = renderLatex('\\R', false);

    expect(result.error).toBeNull();
    expect(result.html).toContain('mathbb');
  });

  it('returns an explicit error payload for invalid latex', () => {
    const result = renderLatex('\\frac{1}{', true);

    expect(result.error).toBeTruthy();
    expect(result.html).toContain('math-error');
    expect(result.errorDetails?.summary).toBeTruthy();
    expect(result.errorDetails?.rawMessage).toBeTruthy();
  });

  it('validates latex strings consistently with the renderer expectations', () => {
    expect(isValidLatex('')).toBe(true);
    expect(isValidLatex('\\sqrt{x}')).toBe(true);
    expect(isValidLatex('\\frac{1}{')).toBe(false);
  });

  it('extracts a structured position, context, and pointer from KaTeX parse errors', () => {
    const details = parseMathRenderError(
      'KaTeX parse error: Undefined control sequence: \\abc at position 12: x^2 + \\abc{y}',
      'x^2 + \\abc{y}'
    );

    expect(details.summary).toBe('Undefined control sequence: \\abc');
    expect(details.position).toBe(12);
    expect(details.line).toBe(1);
    expect(details.column).toBe(12);
    expect(details.locationLabel).toBe('Line 1, column 12');
    expect(details.context).toContain('\\abc');
    expect(details.pointer).toContain('^');
  });

  it('maps KaTeX positions to multiline line and column details', () => {
    const latex = ['x^2 + y^2', '\\frac{1}{2}', '\\badcmd{z}'].join('\n');
    const position = latex.indexOf('\\badcmd') + 1;
    const details = parseMathRenderError(
      `KaTeX parse error: Undefined control sequence: \\badcmd at position ${position}: ${latex}`,
      latex
    );

    expect(details.position).toBe(position);
    expect(details.line).toBe(3);
    expect(details.column).toBe(1);
    expect(details.locationLabel).toBe('Line 3, column 1');
    expect(details.context).toBe('3 | \\badcmd{z}');
    expect(details.pointer).toBe('    ^');
  });

  it('keeps a useful summary even when KaTeX does not report a position', () => {
    const details = parseMathRenderError('KaTeX parse error: Unexpected end of input', '\\frac{1}{');

    expect(details.summary).toBe('Unexpected end of input');
    expect(details.position).toBeNull();
    expect(details.line).toBeNull();
    expect(details.column).toBeNull();
    expect(details.locationLabel).toBeNull();
    expect(details.context).toBeNull();
    expect(details.pointer).toBeNull();
  });
});
