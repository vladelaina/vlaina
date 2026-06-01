import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachPreviewContextMenu, resolvePreviewParagraphInsertPos } from './previewContextMenu';
import { shouldSuppressPreviewEditorOpen, suppressPreviewEditorOpen } from './previewContextMenuSuppression';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';

const mocks = vi.hoisted(() => ({
  getElectronBridge: vi.fn(),
  saveDialog: vi.fn(),
  toJpeg: vi.fn(),
  toPng: vi.fn(),
  toSvg: vi.fn(),
  writeDesktopBinaryFile: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toJpeg: mocks.toJpeg,
  toPng: mocks.toPng,
  toSvg: mocks.toSvg,
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: mocks.getElectronBridge,
}));

vi.mock('@/lib/desktop/fs', () => ({
  writeDesktopBinaryFile: mocks.writeDesktopBinaryFile,
}));

vi.mock('@/lib/storage/dialog', () => ({
  saveDialog: mocks.saveDialog,
}));

function createViewStub() {
  return {
    state: {},
    dispatch: vi.fn(),
    focus: vi.fn(),
  } as never;
}

function openMenu(element: HTMLElement) {
  element.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
    })
  );
}

function menuLabels() {
  return [...document.querySelectorAll('button')].map((button) => button.textContent?.replace(/\s+/g, ' ').trim());
}

function selectMenuItem(label: string) {
  const button = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === label);
  if (!button) {
    throw new Error(`Missing menu item: ${label}`);
  }
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

describe('previewContextMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mocks.getElectronBridge.mockReset();
    mocks.saveDialog.mockReset();
    mocks.toJpeg.mockReset();
    mocks.toPng.mockReset();
    mocks.toSvg.mockReset();
    mocks.writeDesktopBinaryFile.mockReset();

    mocks.getElectronBridge.mockReturnValue({});
    mocks.saveDialog.mockImplementation(async (options: { defaultPath: string }) => `/tmp/${options.defaultPath}`);
    mocks.toJpeg.mockResolvedValue('data:image/jpeg;base64,anBn');
    mocks.toPng.mockResolvedValue('data:image/png;base64,cG5n');
    mocks.toSvg.mockResolvedValue('data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E');
    mocks.writeDesktopBinaryFile.mockResolvedValue(undefined);
  });

  it('centers the context menu on the preview after right click', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 100,
        y: 120,
        left: 100,
        top: 120,
        right: 500,
        bottom: 320,
        width: 400,
        height: 200,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    const menu = document.querySelector('.editor-preview-context-menu') as HTMLElement;

    expect(menu.style.left).toBe('300px');
    expect(menu.style.top).toBe('220px');
    expect(menu.style.transform).toBe('translate(-50%, -50%)');

    session.destroy();
  });

  it('recenters the context menu when the window resizes', () => {
    const element = document.createElement('div');
    let rect = {
      x: 100,
      y: 120,
      left: 100,
      top: 120,
      right: 500,
      bottom: 320,
      width: 400,
      height: 200,
      toJSON: () => ({}),
    };
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    rect = {
      ...rect,
      left: 200,
      top: 80,
      right: 600,
      bottom: 280,
      x: 200,
      y: 80,
    };
    window.dispatchEvent(new Event('resize'));

    const menu = document.querySelector('.editor-preview-context-menu') as HTMLElement;
    expect(menu.style.left).toBe('400px');
    expect(menu.style.top).toBe('180px');

    session.destroy();
  });

  it('recenters the context menu when the document scrolls', () => {
    const element = document.createElement('div');
    let rect = {
      x: 100,
      y: 120,
      left: 100,
      top: 120,
      right: 500,
      bottom: 320,
      width: 400,
      height: 200,
      toJSON: () => ({}),
    };
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    rect = {
      ...rect,
      left: 60,
      top: 40,
      right: 460,
      bottom: 240,
      x: 60,
      y: 40,
    };
    window.dispatchEvent(new Event('scroll'));

    const menu = document.querySelector('.editor-preview-context-menu') as HTMLElement;
    expect(menu.style.left).toBe('260px');
    expect(menu.style.top).toBe('140px');

    session.destroy();
  });

  it('opens submenus to the left when the right side is constrained', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 600,
        y: 120,
        left: 600,
        top: 120,
        right: 760,
        bottom: 320,
        width: 160,
        height: 200,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    const menu = document.querySelector('.editor-preview-context-menu') as HTMLElement;
    Object.defineProperty(menu, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 620,
        y: 120,
        left: 620,
        top: 120,
        right: window.innerWidth - 40,
        bottom: 220,
        width: 300,
        height: 100,
        toJSON: () => ({}),
      }),
    });
    window.dispatchEvent(new Event('resize'));

    expect(menu.classList.contains('editor-preview-context-menu-submenu-left')).toBe(true);

    session.destroy();
  });

  it('opens shared actions for preview nodes', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);

    expect(document.querySelector('.editor-preview-context-menu')).not.toBeNull();
    expect(document.querySelector('.editor-preview-context-menu')?.classList.contains('slash-menu')).toBe(true);
    expect(document.querySelector('.editor-preview-context-menu')?.className).toContain(chatComposerPillSurfaceClass);
    expect(document.querySelectorAll('.editor-preview-context-submenu')).toHaveLength(2);
    expect(menuLabels()).toEqual(['Save as image', 'PNG', 'JPG', 'SVG', 'Insert paragraph', 'Above', 'Below']);

    session.destroy();
  });

  it('attaches global reposition listeners only while a menu is open', () => {
    const windowAdd = vi.spyOn(window, 'addEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const element = document.createElement('div');
    document.body.appendChild(element);

    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    expect(windowAdd).not.toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(windowAdd).not.toHaveBeenCalledWith('resize', expect.any(Function));
    expect(documentAdd).not.toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(documentAdd).not.toHaveBeenCalledWith('keydown', expect.any(Function));

    openMenu(element);

    expect(windowAdd).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(windowAdd).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(documentAdd).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(documentAdd).toHaveBeenCalledWith('keydown', expect.any(Function));

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(windowRemove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(windowRemove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('keydown', expect.any(Function));

    session.destroy();
  });

  it('shows icons on parent actions and insert direction actions', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);

    const buttons = [...document.querySelectorAll('button')];
    const iconLabels = buttons
      .filter((button) => button.querySelector('.slash-menu-item-icon svg'))
      .map((button) => button.textContent?.replace(/\s+/g, ' ').trim());
    expect(iconLabels).toEqual(['Save as image', 'Insert paragraph', 'Above', 'Below']);

    session.destroy();
  });

  it('keeps the preview highlighted while the context menu is open', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);

    expect(element.classList.contains('editor-preview-context-menu-active')).toBe(true);

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(element.classList.contains('editor-preview-context-menu-active')).toBe(false);

    session.destroy();
  });

  it('suppresses the follow-up click that can open the inline editor after right click', () => {
    const element = document.createElement('div');
    const clickListener = vi.fn();
    document.body.appendChild(element);
    document.body.addEventListener('click', clickListener);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(clickListener).not.toHaveBeenCalled();

    document.body.removeEventListener('click', clickListener);
    session.destroy();
    suppressPreviewEditorOpen(0);
  });

  it('marks preview editor opening as suppressed after right click', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'preview',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);

    expect(shouldSuppressPreviewEditorOpen()).toBe(true);

    session.destroy();
    suppressPreviewEditorOpen(0);
  });

  it('serializes an existing SVG without rasterizing first', async () => {
    const element = document.createElement('div');
    element.innerHTML = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>';
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'diagram',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    selectMenuItem('SVG');

    await waitFor(() => expect(mocks.writeDesktopBinaryFile).toHaveBeenCalled());
    expect(mocks.toSvg).not.toHaveBeenCalled();
    const [, bytes] = mocks.writeDesktopBinaryFile.mock.calls[0];
    expect(mocks.writeDesktopBinaryFile.mock.calls[0][0]).toBe('/tmp/diagram.svg');
    expect(new TextDecoder().decode(bytes)).toContain('<svg');

    session.destroy();
  });

  it('exports raster formats through html-to-image', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const session = attachPreviewContextMenu({
      element,
      fileBaseName: 'formula',
      getPos: () => 0,
      node: { isInline: false } as never,
      view: createViewStub(),
    });

    openMenu(element);
    selectMenuItem('PNG');
    await waitFor(() => expect(mocks.toPng).toHaveBeenCalled());
    openMenu(element);
    selectMenuItem('JPG');
    await waitFor(() => expect(mocks.toJpeg).toHaveBeenCalled());

    expect(mocks.toPng).toHaveBeenCalledWith(element, expect.objectContaining({ backgroundColor: '#ffffff' }));
    expect(mocks.toJpeg).toHaveBeenCalledWith(element, expect.objectContaining({ quality: 0.95 }));
    expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith('/tmp/formula.png', expect.any(Uint8Array));
    expect(mocks.writeDesktopBinaryFile).toHaveBeenCalledWith('/tmp/formula.jpg', expect.any(Uint8Array));

    session.destroy();
  });

  it('resolves inline preview paragraph insertion before its containing paragraph', () => {
    const inlineNode = { isInline: true } as never;
    const view = {
      state: {
        doc: {
          resolve: () => ({
            before: () => 0,
            depth: 1,
            node: () => ({ isTextblock: true }),
          }),
        },
      },
    } as never;

    expect(resolvePreviewParagraphInsertPos(view, inlineNode, () => 7, 'above')).toBe(0);
  });

  it('resolves inline preview paragraph insertion after its containing paragraph', () => {
    const inlineNode = { isInline: true } as never;
    const view = {
      state: {
        doc: {
          resolve: () => ({
            after: () => 12,
            depth: 1,
            node: () => ({ isTextblock: true }),
          }),
        },
      },
    } as never;

    expect(resolvePreviewParagraphInsertPos(view, inlineNode, () => 7, 'below')).toBe(12);
  });
});
