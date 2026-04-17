import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { UploadTab, type CustomIcon } from './UploadTab';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 52,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 52,
        start: index * 52,
      })),
    measure: vi.fn(),
  }),
}));

vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
    open: vi.fn(),
  }),
}));

vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="cropper" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/components/ui/premium-slider', () => ({
  PremiumSlider: () => <div data-testid="premium-slider" />,
}));

vi.mock('@/components/ui/deletable-item', () => ({
  DeletableItem: ({
    id,
    onDelete,
    children,
    className,
  }: {
    id: string;
    onDelete?: (id: string) => void;
    children: ReactNode;
    className?: string;
  }) => (
    <div className={className}>
      <button type="button" data-testid={`delete-${id}`} onClick={() => onDelete?.(id)}>
        delete
      </button>
      {children}
    </div>
  ),
}));

vi.mock('./UniversalIcon', () => ({
  UniversalIcon: ({ icon }: { icon: string }) => <img alt={`icon-${icon}`} src={icon} />,
}));

function buildIcon(id: string): CustomIcon {
  return {
    id,
    url: `https://example.com/${id}.png`,
    name: id,
  };
}

describe('UploadTab', () => {
  it('shows an empty-state message when there are no saved icons', () => {
    render(<UploadTab onSelect={() => {}} onPreview={() => {}} onClose={() => {}} customIcons={[]} />);

    expect(screen.getByText('No saved icons yet')).toBeInTheDocument();
  });

  it('supports preview, selection, and deletion from the custom icon library', () => {
    const onSelect = vi.fn();
    const onPreview = vi.fn();
    const onClose = vi.fn();
    const onDeleteCustomIcon = vi.fn();

    render(
      <UploadTab
        onSelect={onSelect}
        onPreview={onPreview}
        onClose={onClose}
        onDeleteCustomIcon={onDeleteCustomIcon}
        customIcons={[buildIcon('first'), buildIcon('second')]}
      />,
    );

    const icon = screen.getByAltText('icon-https://example.com/first.png');
    const clickableArea = icon.parentElement;
    expect(clickableArea).not.toBeNull();

    fireEvent.mouseEnter(clickableArea!);
    expect(onPreview).toHaveBeenCalledWith('https://example.com/first.png');

    fireEvent.mouseLeave(clickableArea!);
    expect(onPreview).toHaveBeenLastCalledWith(null);

    fireEvent.click(clickableArea!);
    expect(onSelect).toHaveBeenCalledWith('https://example.com/first.png');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('delete-second'));
    expect(onDeleteCustomIcon).toHaveBeenCalledWith('second');
  });
});
