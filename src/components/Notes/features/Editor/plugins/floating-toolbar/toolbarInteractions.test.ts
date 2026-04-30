import { describe, expect, it, vi } from 'vitest';
import {
  createToolbarEventDelegation,
  focusSelectedCodeBlockAfterDelete,
} from './toolbarInteractions';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { TOOLBAR_ACTIONS } from './types';
import { linkTooltipPluginKey } from '../links';

describe('toolbar interactions', () => {
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
});
