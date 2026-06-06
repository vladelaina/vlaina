import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import type { CalloutBlockAttrs, IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';
import { iconDataFromValue, normalizeCalloutBackgroundColor, normalizeCalloutIcon } from './calloutIconUtils';
import { CalloutIconControl } from './CalloutIconControl';
import {
  getCalloutCompatibilityClassName,
  getCalloutTitleCompatibilityClassName,
  getObsidianCalloutRgb,
  getObsidianCalloutType,
} from './calloutThemeCompatibility';

export class CalloutNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private node: ProseNode;
  private readonly view: EditorView;
  private readonly getPos: () => number | undefined;
  private readonly titleDOM: HTMLElement;
  private readonly iconDOM: HTMLElement;
  private readonly titleInnerDOM: HTMLElement;
  private readonly root: Root;

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.titleDOM = document.createElement('div');
    this.iconDOM = document.createElement('div');
    this.titleInnerDOM = document.createElement('div');
    this.contentDOM = document.createElement('div');

    this.titleDOM.className = 'callout-title';
    this.titleDOM.contentEditable = 'false';
    this.iconDOM.className = 'callout-icon';
    this.iconDOM.contentEditable = 'false';
    this.titleInnerDOM.className = 'callout-title-inner';
    this.titleInnerDOM.setAttribute('aria-hidden', 'true');
    this.contentDOM.className = 'callout-content';

    this.titleDOM.append(this.iconDOM, this.titleInnerDOM);
    this.dom.append(this.titleDOM, this.contentDOM);
    this.root = createRoot(this.iconDOM);

    this.syncDomAttrs();
    this.render();
  }

  private syncDomAttrs() {
    const attrs = this.node.attrs as CalloutBlockAttrs;
    const icon = normalizeCalloutIcon(attrs.icon);
    const backgroundColor = normalizeCalloutBackgroundColor(attrs.backgroundColor);
    this.dom.dataset.type = 'callout';
    this.dom.dataset.icon = JSON.stringify(icon);
    this.dom.dataset.bg = backgroundColor;
    this.dom.dataset.callout = getObsidianCalloutType(backgroundColor);
    this.dom.dataset.calloutMetadata = '';
    this.dom.className = getCalloutCompatibilityClassName(backgroundColor);
    this.titleDOM.className = getCalloutTitleCompatibilityClassName(backgroundColor);
    this.dom.style.setProperty('--callout-color', getObsidianCalloutRgb(backgroundColor));
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
    this.view.dom.dispatchEvent(new CustomEvent('editor:block-user-input', { bubbles: true }));
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, attrs));
    this.view.focus();
  }

  private render() {
    const attrs = this.node.attrs as { icon?: IconData };
    this.root.render(
      React.createElement(CalloutIconControl, {
        icon: normalizeCalloutIcon(attrs.icon ?? DEFAULT_CALLOUT_ICON),
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
