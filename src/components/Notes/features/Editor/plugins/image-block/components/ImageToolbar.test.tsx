import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageToolbar } from './ImageToolbar';

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
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
});
