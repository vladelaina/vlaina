import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBlockDragSession } from './blockDragSession';

function setupViewDom() {
  const editorRoot = document.createElement('div');
  editorRoot.className = 'milkdown-editor';
  const dom = document.createElement('div');
  editorRoot.appendChild(dom);
  document.body.appendChild(editorRoot);
  return {
    view: { dom } as any,
    editorRoot,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

describe('startBlockDragSession', () => {
  it('treats mouse up without dragging as plain click', () => {
    const { view } = setupViewDom();
    const onActivate = vi.fn();
    const onDragMove = vi.fn();
    const onPlainClick = vi.fn();
    const onTeardown = vi.fn();
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 20,
    });

    startBlockDragSession({
      view,
      event,
      startZone: 'outside-editor',
      dragThreshold: 6,
      cursor: 'crosshair',
      onActivate,
      onDragMove,
      onPlainClick,
      onTeardown,
    });

    expect(document.body.classList.contains('vlaina-block-selection-pending')).toBe(true);
    expect(document.body.style.cursor).toBe('text');
    expect(view.dom.style.cursor).toBe('text');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(onActivate).not.toHaveBeenCalled();
    expect(onDragMove).not.toHaveBeenCalled();
    expect(onPlainClick).toHaveBeenCalledWith('outside-editor');
    expect(onTeardown).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains('vlaina-block-selection-pending')).toBe(false);
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('activates drag after threshold and emits normalized selection rect', () => {
    const { view } = setupViewDom();
    const onActivate = vi.fn();
    const onDragMove = vi.fn();
    const onPlainClick = vi.fn();
    const onTeardown = vi.fn();
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 30,
    });

    startBlockDragSession({
      view,
      event,
      startZone: 'below-last-block',
      dragThreshold: 4,
      cursor: 'crosshair',
      onActivate,
      onDragMove,
      onPlainClick,
      onTeardown,
    });

    expect(document.body.classList.contains('vlaina-block-selection-pending')).toBe(true);
    expect(document.body.style.cursor).toBe('text');
    expect(view.dom.style.cursor).toBe('text');

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 42,
      clientY: 32,
      buttons: 1,
    }));

    expect(document.body.style.cursor).toBe('text');
    expect(view.dom.style.cursor).toBe('text');

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 54,
      buttons: 1,
    }));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onDragMove).toHaveBeenCalledTimes(1);
    expect(onDragMove).toHaveBeenCalledWith({
      left: 24,
      top: 30,
      right: 40,
      bottom: 54,
    });
    expect(document.body.classList.contains('vlaina-block-dragging-cursor')).toBe(true);
    expect(document.body.style.cursor).toBe('crosshair');
    expect(view.dom.style.cursor).toBe('crosshair');
    expect(document.body.style.userSelect).toBe('none');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(onPlainClick).not.toHaveBeenCalled();
    expect(onTeardown).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains('vlaina-block-selection-pending')).toBe(false);
    expect(document.body.classList.contains('vlaina-block-dragging-cursor')).toBe(false);
    expect(document.body.style.userSelect).toBe('');
  });

  it('can be stopped manually', () => {
    const { view } = setupViewDom();
    const onActivate = vi.fn();
    const onDragMove = vi.fn();
    const onPlainClick = vi.fn();
    const onTeardown = vi.fn();
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 8,
      clientY: 8,
    });

    const session = startBlockDragSession({
      view,
      event,
      startZone: 'outside-editor',
      dragThreshold: 1,
      cursor: 'crosshair',
      onActivate,
      onDragMove,
      onPlainClick,
      onTeardown,
    });

    session.stop();
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
      buttons: 1,
    }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(onActivate).not.toHaveBeenCalled();
    expect(onDragMove).not.toHaveBeenCalled();
    expect(onPlainClick).not.toHaveBeenCalled();
    expect(onTeardown).toHaveBeenCalledTimes(1);
  });
});
