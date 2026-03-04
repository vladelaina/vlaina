import { createRef, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoverImageShell } from './CoverImageShell';
import type { CoverRendererProps } from './coverRenderer.types';

const hoisted = vi.hoisted(() => ({
  coverPickerSpy: vi.fn(),
  coverRendererSpy: vi.fn(),
}));

vi.mock('../../../AssetLibrary', () => ({
  CoverPicker: (props: unknown) => {
    hoisted.coverPickerSpy(props);
    return <div data-testid="cover-picker" />;
  },
}));

vi.mock('./CoverRenderer', () => ({
  CoverRenderer: (props: unknown) => {
    hoisted.coverRendererSpy(props);
    return <div data-testid="cover-renderer" />;
  },
}));

function buildRendererProps(overrides?: Partial<Omit<CoverRendererProps, 'displaySrc' | 'positionX' | 'positionY'>>): Omit<CoverRendererProps, 'displaySrc' | 'positionX' | 'positionY'> {
  return {
    placeholderSrc: '/placeholder.webp',
    isImageReady: true,
    isResizing: false,
    wrapperRef: createRef<HTMLDivElement>(),
    frozenImgRef: createRef<HTMLImageElement>(),
    frozenImageState: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    effectiveContainerSize: { width: 800, height: 320 },
    effectiveMinZoom: 1,
    effectiveMaxZoom: 10,
    objectFitMode: 'horizontal-cover',
    onCropperCropChange: vi.fn(),
    onCropperZoomChange: vi.fn(),
    onPointerIntent: vi.fn(),
    onPointerMoveIntent: vi.fn(),
    onNonPointerIntent: vi.fn(),
    onInteractionStart: vi.fn(),
    onInteractionEnd: vi.fn(),
    onMediaLoaded: vi.fn(),
    ...overrides,
  };
}

function buildShellProps(overrides?: Partial<ComponentProps<typeof CoverImageShell>>): ComponentProps<typeof CoverImageShell> {
  return {
    url: null,
    readOnly: false,
    vaultPath: '/vault-a',
    phase: 'idle',
    showPicker: false,
    previewSrc: null,
    isError: false,
    displaySrc: '',
    coverHeight: 320,
    positionX: 50,
    positionY: 50,
    containerRef: createRef<HTMLDivElement>(),
    onOpenPicker: vi.fn(),
    onClosePicker: vi.fn(),
    onSelectCover: vi.fn(),
    onPreview: vi.fn(),
    onRemoveCover: vi.fn(),
    onResizeMouseDown: vi.fn(),
    onResetHeight: vi.fn(),
    rendererProps: buildRendererProps(),
    ...overrides,
  };
}

describe('CoverImageShell', () => {
  beforeEach(() => {
    hoisted.coverPickerSpy.mockReset();
    hoisted.coverRendererSpy.mockReset();
  });

  it('returns null when phase is idle and picker is closed', () => {
    const { container } = render(<CoverImageShell {...buildShellProps()} />);
    expect(container.firstChild).toBeNull();
    expect(hoisted.coverPickerSpy).not.toHaveBeenCalled();
  });

  it('renders picker even in idle phase when picker is open', () => {
    render(
      <CoverImageShell
        {...buildShellProps({
          showPicker: true,
        })}
      />
    );
    expect(screen.getByTestId('cover-picker')).toBeInTheDocument();
    expect(hoisted.coverPickerSpy).toHaveBeenCalled();
  });

  it('renders cover renderer when url exists', () => {
    render(
      <CoverImageShell
        {...buildShellProps({
          phase: 'ready',
          url: '@monet/2',
          displaySrc: '/covers/Claude Monet/2.webp',
        })}
      />
    );
    expect(screen.getByTestId('cover-renderer')).toBeInTheDocument();
    expect(hoisted.coverRendererSpy).toHaveBeenCalled();
  });
});
