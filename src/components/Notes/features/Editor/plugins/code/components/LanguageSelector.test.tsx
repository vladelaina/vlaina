import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { LanguageSelector } from './LanguageSelector';

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ open, children }: { open: boolean; children?: ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
  PopoverAnchor: ({ children, asChild: _asChild, ...props }: { children?: ReactNode; asChild?: boolean }) => (
    <div {...props}>{children}</div>
  ),
  PopoverContent: ({
    children,
    align: _align,
    sideOffset: _sideOffset,
    onOpenAutoFocus: _onOpenAutoFocus,
    ...props
  }: {
    children?: ReactNode;
    align?: string;
    sideOffset?: number;
    onOpenAutoFocus?: (event: Event) => void;
  }) => (
    <div data-testid="language-selector-content" {...props}>
      {children}
    </div>
  ),
}));

describe('LanguageSelector', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('uses lowercase capsule options inside the shared pill surface', () => {
    render(
      <LanguageSelector
        language="ts"
        displayName="typescript"
        getNodeText={() => 'const value: string = "ok";'}
        onLanguageChange={vi.fn()}
        isOpen
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('language-selector-content').className).toContain(chatComposerPillSurfaceClass);

    const javascriptOption = screen.getByRole('button', { name: 'javascript' });
    expect(javascriptOption.className).toContain('rounded-full');
    expect(screen.queryByRole('button', { name: 'JavaScript' })).toBeNull();
  });
});
