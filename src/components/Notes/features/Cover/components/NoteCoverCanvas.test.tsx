import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteCoverCanvas } from './NoteCoverCanvas';
import type { NoteCoverController } from '../types';

const hoisted = vi.hoisted(() => ({
  mountSpy: vi.fn(),
  unmountSpy: vi.fn(),
  renderSpy: vi.fn(),
}));

vi.mock('./CoverImage/CoverImage', () => ({
  CoverImage: (props: unknown) => {
    hoisted.renderSpy(props);

    useEffect(() => {
      hoisted.mountSpy();
      return () => {
        hoisted.unmountSpy();
      };
    }, []);

    return <div data-testid="cover-image" />;
  },
}));

function createController(): NoteCoverController {
  return {
    cover: {
      url: 'covers/example.png',
      positionX: 50,
      positionY: 50,
      height: 220,
      scale: 1,
    },
    vaultPath: '/vault',
    isPickerOpen: false,
    setPickerOpen: vi.fn(),
    updateCover: vi.fn(),
    addRandomCoverAndOpenPicker: vi.fn(),
  };
}

describe('NoteCoverCanvas', () => {
  beforeEach(() => {
    hoisted.mountSpy.mockReset();
    hoisted.unmountSpy.mockReset();
    hoisted.renderSpy.mockReset();
  });

  it('keeps the cover image mounted when note path changes', () => {
    const controller = createController();
    const { rerender } = render(
      <NoteCoverCanvas controller={controller} notePath="a.md" />
    );

    expect(hoisted.mountSpy).toHaveBeenCalledTimes(1);
    expect(hoisted.unmountSpy).not.toHaveBeenCalled();
    expect(hoisted.renderSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      url: 'covers/example.png',
      positionX: 50,
      positionY: 50,
      height: 220,
      scale: 1,
    }));

    const nextController: NoteCoverController = {
      ...controller,
      cover: {
        url: 'covers/next.png',
        positionX: 32,
        positionY: 64,
        height: 260,
        scale: 1.25,
      },
    };

    rerender(<NoteCoverCanvas controller={nextController} notePath="b.md" />);

    expect(hoisted.unmountSpy).not.toHaveBeenCalled();
    expect(hoisted.mountSpy).toHaveBeenCalledTimes(1);
    expect(hoisted.renderSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      url: 'covers/next.png',
      positionX: 32,
      positionY: 64,
      height: 260,
      scale: 1.25,
    }));
  });
});
