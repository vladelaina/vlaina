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

  it('matches the sidebar search field shell and keeps the language trigger backgroundless', () => {
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

    const trigger = screen.getAllByRole('button', { name: 'typescript' })[0];
    expect(trigger.className).toContain('size-7');
    expect(trigger.className).toContain('rounded-full');
    expect(trigger.className).not.toContain('hover:bg-');
    expect(trigger.className).not.toContain('dark:hover:bg-');
    expect(trigger.className).not.toContain(chatComposerPillSurfaceClass);

    const searchInput = screen.getByPlaceholderText('Search language...');
    expect(searchInput.parentElement?.className).toContain('h-[40px]');
    expect(searchInput.parentElement?.className).toContain('rounded-full');
    expect(searchInput.parentElement?.className).toContain(chatComposerPillSurfaceClass);

    const autoDetectButton = screen.getByTitle('Auto Detect Language');
    expect(autoDetectButton.className).toContain('rounded-full');
    expect(autoDetectButton.className).toContain('hover:bg-blue-500/10');
    expect(autoDetectButton.className).toContain('hover:text-blue-500');
  });
});
