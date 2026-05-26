import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatImageViewer } from './ChatImageViewer';

vi.mock('react-easy-crop', () => ({
  default: (props: { setImageRef?: (ref: { current: HTMLImageElement | null }) => void }) => {
    const setImageNode = (node: HTMLImageElement | null) => {
      if (!node) {
        return;
      }
      Object.defineProperty(node, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          x: 300,
          y: 200,
          left: 300,
          top: 200,
          right: 500,
          bottom: 400,
          width: 200,
          height: 200,
          toJSON: () => ({}),
        }),
      });
      props.setImageRef?.({ current: node });
    };

    return (
      <>
        <img ref={setImageNode} alt="" data-testid="mock-cropper-image" />
        <div
          data-testid="mock-cropper"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      </>
    );
  },
}));

describe('ChatImageViewer', () => {
  it('closes when the blank area is pressed even if the cropper stops bubbling events', async () => {
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="https://example.com/image.png"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const cropper = await screen.findByTestId('mock-cropper');
    fireEvent.pointerDown(cropper, { button: 0, clientX: 10, clientY: 10 });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the viewer open when the image area is pressed', async () => {
    const onOpenChange = vi.fn();

    render(
      <ChatImageViewer
        open
        src="https://example.com/image.png"
        alt="preview"
        onOpenChange={onOpenChange}
      />,
    );

    const image = await screen.findByTestId('mock-cropper-image');
    fireEvent.pointerDown(image, { button: 0, clientX: 350, clientY: 250 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
