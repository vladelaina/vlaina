import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageToolbar } from './ImageToolbar';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: () => ({ addToast: mocks.addToast }),
}));

function renderToolbar(overrides: Partial<Parameters<typeof ImageToolbar>[0]> = {}) {
  return render(
    <ImageToolbar
      alignment="center"
      onAlign={vi.fn()}
      onEdit={vi.fn()}
      onCopy={vi.fn()}
      onDownload={vi.fn()}
      onDelete={vi.fn()}
      isVisible={true}
      {...overrides}
    />
  );
}

describe('ImageToolbar', () => {
  beforeEach(() => {
    mocks.addToast.mockClear();
  });

  it('hides edit, copy, and download actions when media actions are disabled', () => {
    renderToolbar({ hideMediaActions: true });

    expect(screen.queryByTestId('icon-editor.crop')).toBeNull();
    expect(screen.queryByTestId('icon-common.copy')).toBeNull();
    expect(screen.queryByTestId('icon-common.download')).toBeNull();
    expect(screen.getByTestId('icon-editor.alignLeft')).toBeInTheDocument();
    expect(screen.getByTestId('icon-editor.alignCenter')).toBeInTheDocument();
    expect(screen.getByTestId('icon-editor.alignRight')).toBeInTheDocument();
    expect(screen.getByTestId('icon-common.delete')).toBeInTheDocument();
  });

  it('prevents toolbar mouse down from changing the editor selection', () => {
    renderToolbar();
    const copyButton = screen.getByTestId('icon-common.copy').closest('button');
    expect(copyButton).not.toBeNull();

    const prevented = !fireEvent.mouseDown(copyButton!, { button: 0 });

    expect(prevented).toBe(true);
  });

  it('shows feedback when image copy fails', async () => {
    renderToolbar({ onCopy: vi.fn(async () => false) });

    fireEvent.click(screen.getByTestId('icon-common.copy').closest('button')!);

    await waitFor(() => {
      expect(mocks.addToast).toHaveBeenCalledWith('chat.copyImageFailed', 'error');
    });
    expect(screen.queryByTestId('icon-common.check')).toBeNull();
  });
});
