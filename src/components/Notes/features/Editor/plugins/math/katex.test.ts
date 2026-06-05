import { describe, expect, it, vi } from 'vitest';
import { isValidLatex, parseMathRenderError, renderLatex } from './katex';

vi.mock('@/lib/i18n', () => ({
  translate: () => '<img src=x onerror=alert(1)>&"\'',
}));

describe('katex utils', () => {
  it('renders empty inline and block latex without visible placeholder copy', () => {
    expect(renderLatex('', false)).toEqual({
      html: '<span class="math-empty" aria-hidden="true">\u200b</span>',
      error: null,
      errorDetails: null,
    });
    expect(renderLatex('   ', true)).toEqual({
      html: '<span class="math-empty" aria-hidden="true">\u200b</span>',
      error: null,
      errorDetails: null,
    });
  });

  it('renders valid latex without an error', () => {
    const result = renderLatex('x^2 + y^2', false);

    expect(result.error).toBeNull();
    expect(result.html).toContain('katex');
  });

  it('removes raw TeX source annotations from rendered markup', () => {
    const result = renderLatex('x% hidden_secret_marker', false);

    expect(result.error).toBeNull();
    expect(result.html).toContain('katex');
    expect(result.html).not.toContain('application/x-tex');
    expect(result.html).not.toContain('hidden_secret_marker');
  });

  it('supports configured macros during rendering', () => {
    const result = renderLatex('\\R', false);

    expect(result.error).toBeNull();
    expect(result.html).toContain('mathbb');
  });

  it('renders display math line breaks written with double backslashes or newline commands', () => {
    const doubleBackslash = renderLatex('a \\\\ b', true);
    const newlineCommand = renderLatex('a \\newline b', true);

    expect(doubleBackslash.error).toBeNull();
    expect(doubleBackslash.html).toContain('mspace linebreak');
    expect(newlineCommand.error).toBeNull();
    expect(newlineCommand.html).toContain('mspace linebreak');
  });

  it('renders aligned display math with double backslash row breaks', () => {
    const result = renderLatex('\\begin{aligned}a&=b\\\\c&=d\\end{aligned}', true);

    expect(result.error).toBeNull();
    expect(result.html).toContain('mtable');
    expect(result.html).toContain('mtr');
  });

  it('renders common display math structures used in notes', () => {
    const cases = renderLatex('\\begin{cases}x+1,&x>0\\\\0,&x=0\\end{cases}', true);
    const matrix = renderLatex('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}', true);
    const align = renderLatex('\\begin{align}a&=b\\\\c&=d\\end{align}', true);
    const gather = renderLatex('\\begin{gather}a=b\\\\c=d\\end{gather}', true);
    const equation = renderLatex('\\begin{equation}x+y\\end{equation}', true);
    const tagged = renderLatex('\\tag{1} x+y', true);

    expect(cases.error).toBeNull();
    expect(cases.html).toContain('mtable');
    expect(matrix.error).toBeNull();
    expect(matrix.html).toContain('mtable');
    expect(align.error).toBeNull();
    expect(align.html).toContain('mtable');
    expect(gather.error).toBeNull();
    expect(gather.html).toContain('mtable');
    expect(equation.error).toBeNull();
    expect(equation.html).toContain('katex');
    expect(tagged.error).toBeNull();
    expect(tagged.html).toContain('tag');
  });

  it('renders mhchem chemical formula and unit syntax', () => {
    const equation = renderLatex('\\ce{SO4^2- + Ba^2+ -> BaSO4 v}', true);
    const unit = renderLatex('\\pu{123 kJ mol-1}', false);

    expect(equation.error).toBeNull();
    expect(equation.html).toContain('SO');
    expect(equation.html).toContain('Ba');
    expect(unit.error).toBeNull();
    expect(unit.html).toContain('kJ');
  });

  it('returns an explicit error payload for invalid latex', () => {
    const result = renderLatex('\\frac{1}{', true);

    expect(result.error).toBeTruthy();
    expect(result.html).toContain('math-error');
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.html).not.toContain('<img');
    expect(result.errorDetails?.summary).toBeTruthy();
    expect(result.errorDetails?.rawMessage).toBeTruthy();
  });

  it('rejects oversized latex before rendering', () => {
    const result = renderLatex('x'.repeat(10001), false);

    expect(result.error).toBe('Equation is too large to render');
    expect(result.html).toContain('math-error');
  });

  it('validates latex strings consistently with the renderer expectations', () => {
    expect(isValidLatex('')).toBe(true);
    expect(isValidLatex('\\sqrt{x}')).toBe(true);
    expect(isValidLatex('\\R')).toBe(true);
    expect(isValidLatex('\\ce{H2O}')).toBe(true);
    expect(isValidLatex('\\frac{1}{')).toBe(false);
    expect(isValidLatex('x'.repeat(10001))).toBe(false);
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
