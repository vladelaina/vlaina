import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { WhiteboardElementNode } from './WhiteboardElementNode';

const image = {
  height: 80,
  id: 'image-1',
  imageSrc: 'data:image/png;base64,demo',
  text: 'demo.png',
  type: 'image' as const,
  width: 100,
  x: 0,
  y: 0,
};

describe('WhiteboardElementNode', () => {
  it('renders an imported image with resize controls when selected', () => {
    render(<WhiteboardElementNode element={image} resizeLabel="Resize" selected tool="select" onPointerDown={vi.fn()} onResizePointerDown={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'demo.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resize' })).toBeInTheDocument();
  });

  it('dims an image selected by an active erase gesture', () => {
    render(<WhiteboardElementNode element={image} erasing resizeLabel="Resize" selected tool="select" onPointerDown={vi.fn()} onResizePointerDown={vi.fn()} />);
    expect(screen.getByLabelText('demo.png')).toHaveStyle({ opacity: themeWhiteboardTokens.eraserTargetPreviewOpacity });
  });
});
