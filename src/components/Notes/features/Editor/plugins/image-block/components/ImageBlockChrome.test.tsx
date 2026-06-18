import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageBlockChrome, __testing__ } from './ImageBlockChrome';

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

function renderChrome(overrides: Partial<Parameters<typeof ImageBlockChrome>[0]> = {}) {
  return render(
    <ImageBlockChrome
      nodeAlt="example image"
      captionInput="example image"
      isEditingCaption={false}
      isHovered={true}
      isActive={false}
      isDragging={false}
      loadError={false}
      containerSize={{ width: 320, height: 180 }}
      alignment="center"
      onCaptionChange={vi.fn()}
      onCaptionSubmit={vi.fn()}
      onCaptionCancel={vi.fn()}
      onCaptionEditStart={vi.fn()}
      onAlign={vi.fn()}
      onEdit={vi.fn()}
      onCopy={vi.fn()}
      onDownload={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />
  );
}

describe('ImageBlockChrome', () => {
  it('moves the caption to the lower left when short images would stack image chrome', () => {
    renderChrome({
      containerSize: {
        width: 320,
        height: __testing__.IMAGE_CHROME_VERTICAL_STACK_MIN_HEIGHT - 1,
      },
    });

    const caption = screen.getByText('example image').closest('.image-caption-toolbar');

    expect(caption).not.toBeNull();
    expect(caption!).toHaveClass('left-2');
    expect(caption!).not.toHaveClass('right-2');
  });

  it('keeps the caption in the lower right when there is enough vertical room', () => {
    renderChrome({
      containerSize: {
        width: 320,
        height: __testing__.IMAGE_CHROME_VERTICAL_STACK_MIN_HEIGHT,
      },
    });

    const caption = screen.getByText('example image').closest('.image-caption-toolbar');

    expect(caption).not.toBeNull();
    expect(caption!).toHaveClass('right-2');
    expect(caption!).not.toHaveClass('left-2');
  });
});
