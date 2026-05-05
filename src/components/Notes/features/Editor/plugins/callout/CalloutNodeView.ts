import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import type { CalloutBlockAttrs, IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';
import { iconDataFromValue } from './calloutIconUtils';
import { CalloutIconControl } from './CalloutIconControl';

export class CalloutNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private node: ProseNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private readonly iconDOM: HTMLElement;
  private readonly root: Root;

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.iconDOM = document.createElement('div');
    this.contentDOM = document.createElement('div');

    this.iconDOM.className = 'callout-icon';
    this.iconDOM.contentEditable = 'false';
    this.contentDOM.className = 'callout-content';

    this.dom.append(this.iconDOM, this.contentDOM);
    this.root = createRoot(this.iconDOM);

    this.syncDomAttrs();
    this.render();
  }

  private syncDomAttrs() {
    const attrs = this.node.attrs as CalloutBlockAttrs;
    this.dom.dataset.type = 'callout';
    this.dom.dataset.icon = JSON.stringify(attrs.icon);
    this.dom.dataset.bg = attrs.backgroundColor;
    this.dom.className = `callout callout-${attrs.backgroundColor}`;
  }

  private updateIcon(value: string) {
    const pos = this.getPos();
    if (pos === undefined) {
      return;
    }

    const icon = iconDataFromValue(value);
    const attrs = {
      ...this.node.attrs,
      icon,
    };
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, attrs));
    this.view.focus();
  }

  private render() {
    const attrs = this.node.attrs as { icon?: IconData };
    this.root.render(
      React.createElement(CalloutIconControl, {
        icon: attrs.icon ?? DEFAULT_CALLOUT_ICON,
        onChange: (value: string) => this.updateIcon(value),
      })
    );
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) {
      return false;
    }

    const previousIcon = JSON.stringify(this.node.attrs.icon);
    const nextIcon = JSON.stringify(node.attrs.icon);
    this.node = node;
    this.syncDomAttrs();

    if (previousIcon !== nextIcon) {
      this.render();
    }

    return true;
  }

  stopEvent(event: Event) {
    const target = event.target;
    return target instanceof HTMLElement && Boolean(target.closest('.callout-icon'));
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) {
    if (mutation.type === 'selection') {
      return false;
    }

    return mutation.target instanceof HTMLElement && this.iconDOM.contains(mutation.target);
  }

  destroy() {
    this.root.unmount();
  }
}
