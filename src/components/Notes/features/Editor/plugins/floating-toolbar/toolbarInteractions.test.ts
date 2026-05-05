import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createToolbarEventDelegation,
  focusSelectedCodeBlockAfterDelete,
} from './toolbarInteractions';
import { floatingToolbarKey } from './floatingToolbarKey';
import { TOOLBAR_ACTIONS } from './types';
import { linkTooltipPluginKey } from '../links';

const previewMocks = vi.hoisted(() => ({
  applyFormatPreview: vi.fn(),
  clearFormatPreview: vi.fn(),
  commitFormatPreview: vi.fn(),
}));

vi.mock('./previewStyles', () => ({
  applyFormatPreview: previewMocks.applyFormatPreview,
  clearFormatPreview: previewMocks.clearFormatPreview,
  commitFormatPreview: previewMocks.commitFormatPreview,
  hasFormatPreview: vi.fn((action: string) => ['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'link'].includes(action)),
}));

describe('toolbar interactions', () => {
  beforeEach(() => {
    previewMocks.applyFormatPreview.mockReset();
    previewMocks.clearFormatPreview.mockReset();
    previewMocks.commitFormatPreview.mockReset();
    previewMocks.commitFormatPreview.mockReturnValue(false);
  });

  it('prevents default when pressing blank space inside the toolbar', () => {
    const toolbar = document.createElement('div');
    const blank = document.createElement('div');
    toolbar.appendChild(blank);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    blank.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalled();

    delegation.destroy();
  });

  it('does not prevent default for native controls inside the toolbar', () => {
    const toolbar = document.createElement('div');
    const select = document.createElement('select');
    toolbar.appendChild(select);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    select.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(stopPropagation).not.toHaveBeenCalled();

    delegation.destroy();
  });

  it('hides the floating toolbar when opening the link tooltip from the toolbar', async () => {
    const toolbar = document.createElement('div');
    const button = document.createElement('button');
    button.dataset.action = 'link';
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);

    const tr = {
      setMeta: vi.fn(),
    } as any;
    tr.setMeta.mockReturnValue(tr);

    const dispatch = vi.fn();
    const focus = vi.fn();
    const view = {
      state: {
        selection: {
          from: 3,
          to: 8,
          empty: false,
        },
        doc: {
          nodesBetween: vi.fn(),
        },
        tr,
      },
      dispatch,
      focus,
    } as any;

    const delegation = createToolbarEventDelegation(toolbar);
    delegation.update(view, {} as any);

    button.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));

    await Promise.resolve();

    expect(tr.setMeta).toHaveBeenCalledWith(linkTooltipPluginKey, {
      type: 'SHOW_LINK_TOOLTIP',
      from: 3,
      to: 8,
      autoFocus: false,
    });
    expect(tr.setMeta).toHaveBeenCalledWith(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.HIDE,
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(focus).toHaveBeenCalled();

    delegation.destroy();
  });

  it('focuses the embedded code editor after deleting a code block text selection', () => {
    const codeBlockDom = document.createElement('div');
    const codeMirrorContent = document.createElement('div');
    codeMirrorContent.className = 'cm-content';
    codeMirrorContent.tabIndex = 0;
    codeBlockDom.appendChild(codeMirrorContent);
    document.body.appendChild(codeBlockDom);

    expect(focusSelectedCodeBlockAfterDelete(codeBlockDom)).toBe(true);
    expect(document.activeElement).toBe(codeMirrorContent);
  });

  it('does not claim code block focus when the embedded editor was removed', () => {
    const codeBlockDom = document.createElement('div');
    const codeMirrorContent = document.createElement('div');
    codeMirrorContent.className = 'cm-content';
    codeBlockDom.appendChild(codeMirrorContent);

    expect(focusSelectedCodeBlockAfterDelete(codeBlockDom)).toBe(false);
  });

  it('previews active format buttons as the real toggle-off result', () => {
    const toolbar = document.createElement('div');
    const button = document.createElement('button');
    const view = {} as any;
    button.dataset.action = 'bold';
    button.className = 'active';
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    delegation.update(view, {} as any);

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(previewMocks.applyFormatPreview).toHaveBeenCalledWith(view, 'bold', true);

    delegation.destroy();
  });

  it('does not rebuild direct format previews while moving inside the same button', () => {
    const toolbar = document.createElement('div');
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const view = {} as any;
    button.dataset.action = 'bold';
    button.appendChild(icon);
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    delegation.update(view, {} as any);

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    icon.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      relatedTarget: button,
    }));

    expect(previewMocks.applyFormatPreview).toHaveBeenCalledTimes(1);

    delegation.destroy();
  });

  it('keeps the current preview while moving from a format button into toolbar gaps', () => {
    const toolbar = document.createElement('div');
    const button = document.createElement('button');
    const gap = document.createElement('span');
    const view = {} as any;
    button.dataset.action = 'bold';
    toolbar.append(button, gap);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    delegation.update(view, {} as any);

    button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('mouseout', {
      bubbles: true,
      relatedTarget: gap,
    }));

    expect(previewMocks.applyFormatPreview).toHaveBeenCalledWith(view, 'bold', false);
    expect(previewMocks.clearFormatPreview).not.toHaveBeenCalled();

    delegation.destroy();
  });

  it('clears the current preview when moving from a format button to a non-preview action', () => {
    const toolbar = document.createElement('div');
    const boldButton = document.createElement('button');
    const copyButton = document.createElement('button');
    const view = {} as any;
    boldButton.dataset.action = 'bold';
    copyButton.dataset.action = 'copy';
    toolbar.append(boldButton, copyButton);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    delegation.update(view, {} as any);

    boldButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    boldButton.dispatchEvent(new MouseEvent('mouseout', {
      bubbles: true,
      relatedTarget: copyButton,
    }));
    copyButton.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      relatedTarget: boldButton,
    }));

    expect(previewMocks.clearFormatPreview).toHaveBeenCalledWith(view);

    delegation.destroy();
  });

  it('previews only active link buttons because inactive links open the editor instead', () => {
    const toolbar = document.createElement('div');
    const inactiveLink = document.createElement('button');
    const activeLink = document.createElement('button');
    const view = {} as any;
    inactiveLink.dataset.action = 'link';
    activeLink.dataset.action = 'link';
    activeLink.className = 'active';
    toolbar.append(inactiveLink, activeLink);
    document.body.appendChild(toolbar);

    const delegation = createToolbarEventDelegation(toolbar);
    delegation.update(view, {} as any);

    inactiveLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    activeLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(previewMocks.applyFormatPreview).toHaveBeenCalledTimes(1);
    expect(previewMocks.applyFormatPreview).toHaveBeenCalledWith(view, 'link', true);

    delegation.destroy();
  });
});
