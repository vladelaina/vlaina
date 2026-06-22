import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeBlockHeader } from './CodeBlockHeader';

function renderHeader(onHeaderClick = vi.fn()) {
  const view = render(
    <CodeBlockHeader
      getCopyText={() => 'const value = 1;'}
      languageControl={<span>ts</span>}
      onHeaderClick={onHeaderClick}
    />,
  );
  const header = view.container.querySelector('.code-block-chrome-header') as HTMLElement;
  return { ...view, header, onHeaderClick };
}

describe('CodeBlockHeader', () => {
  it('runs the header action on pointerdown and suppresses the follow-up click', () => {
    const { header, onHeaderClick } = renderHeader();

    fireEvent.pointerDown(header, { button: 0 });
    fireEvent.click(header);

    expect(onHeaderClick).toHaveBeenCalledTimes(1);
  });

  it('keeps click activation as a keyboard and fallback path', () => {
    const { header, onHeaderClick } = renderHeader();

    fireEvent.click(header);

    expect(onHeaderClick).toHaveBeenCalledTimes(1);
  });

  it('does not toggle when the language control handles the click', () => {
    const { container, onHeaderClick } = renderHeader();
    const language = container.querySelector('.code-block-chrome-language') as HTMLElement;

    fireEvent.click(language);

    expect(onHeaderClick).not.toHaveBeenCalled();
  });

  it('uses the shared ghost icon style for copy without a native title tooltip', () => {
    const { container } = renderHeader();
    const copyButton = container.querySelector('.code-block-chrome-copy-button') as HTMLButtonElement;

    expect(copyButton).toBeInstanceOf(HTMLButtonElement);
    expect(copyButton.getAttribute('title')).toBeNull();
    expect(copyButton.className).toContain('hover:bg-[var(--vlaina-color-pill-surface-hover)]');
    expect(copyButton.className).toContain('hover:shadow-[var(--vlaina-shadow-menu-hover)]');
  });
});
