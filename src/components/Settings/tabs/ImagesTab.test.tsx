import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { ImagesTab } from './ImagesTab';

const mocks = vi.hoisted(() => ({
  uiState: {
    imageStorageMode: 'subfolder',
    imageSubfolderName: 'assets',
    imageNotesRootSubfolderName: 'assets',
    imageFilenameFormat: 'original',
    setImageStorageMode: vi.fn(),
    setImageSubfolderName: vi.fn(),
    setImageNotesRootSubfolderName: vi.fn(),
    setImageFilenameFormat: vi.fn(),
  },
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true" data-testid={`icon-${name}`} />,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
    DropdownMenuTrigger: ({
      children,
    }: {
      asChild?: boolean;
      children: ReactElement;
    }) => children,
    DropdownMenuContent: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => <div role="menu" className={className}>{children}</div>,
    DropdownMenuItem: ({
      children,
      className,
      onSelect,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      children: ReactNode;
      onSelect?: () => void;
    }) => (
      <button type="button" role="menuitem" className={className} onClick={() => onSelect?.()} {...props}>
        {children}
      </button>
    ),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: typeof mocks.uiState) => unknown) => selector(mocks.uiState),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => ({
      'common.reset': 'Reset',
      'settings.images.currentFolderDescription': 'Images save next to the current note.',
      'settings.images.directoryCurrentFolder': './',
      'settings.images.directoryNoteSubfolder': `./${values?.folder ?? 'assets'}/`,
      'settings.images.directoryNotesRootRoot': '/',
      'settings.images.directoryNotesRootSubfolder': `/${values?.folder ?? 'assets'}/`,
      'settings.images.filenameFormat': 'Image filename format',
      'settings.images.folderName': 'Folder name',
      'settings.images.images': 'Images',
      'settings.images.numericSequence': 'Numeric sequence',
      'settings.images.originalName': 'Original name',
      'settings.images.storageLocation': 'Storage location',
      'settings.images.subfolderName': 'Subfolder name',
      'settings.images.timestamp': 'Timestamp',
    }[key] ?? key),
  }),
}));

describe('ImagesTab dropdown styling', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reuses the shared capsule surface for both image dropdown lists', () => {
    render(<ImagesTab />);

    const menus = screen.getAllByRole('menu');
    expect(menus).toHaveLength(2);

    menus.forEach((menu) => {
      expect(menu.className).toContain(chatComposerPillSurfaceClass);
      expect(menu.className).toContain('rounded-[var(--vlaina-radius-22px)]');
    });

    expect(document.querySelector('[data-settings-image-storage-mode="subfolder"]')?.className)
      .toContain('rounded-full');
    expect(document.querySelector('[data-settings-image-filename-format="original"]')?.className)
      .toContain('rounded-full');
  });

  it('does not persist a composing image subfolder name', () => {
    render(<ImagesTab />);

    const input = screen.getByLabelText('Subfolder name');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'nihon' } });
    fireEvent.change(input, { target: { value: '日本' } });

    expect(mocks.uiState.setImageSubfolderName).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);

    expect(mocks.uiState.setImageSubfolderName).toHaveBeenCalledWith('日本');
    expect(mocks.uiState.setImageSubfolderName).not.toHaveBeenCalledWith('nihon');
  });
});
