import { type Node } from '@milkdown/kit/prose/model';
import { type EditorView, type NodeView } from '@milkdown/kit/prose/view';

type LoadedCodeBlockNodeView = NodeView & {
  dom: HTMLElement;
  update?: (node: Node) => boolean;
};

export class LazyCodeBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;

  private loadedView: LoadedCodeBlockNodeView | null = null;
  private loading = false;
  private destroyed = false;
  private node: Node;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(
    node: Node,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
  ) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = [
      'code-block-container',
      'vlaina-code-block',
      'my-4',
      'rounded-2xl',
      'overflow-hidden',
      'group/code',
    ].join(' ');
    this.dom.dataset.cmLazy = 'true';

    const placeholder = document.createElement('pre');
    placeholder.className = 'code-block-lazy-preview';
    placeholder.textContent = node.textContent;
    this.dom.appendChild(placeholder);

    this.dom.addEventListener('mousedown', this.loadFromInteraction);
    this.dom.addEventListener('focusin', this.loadFromInteraction);
    this.scheduleLoadWhenNearViewport();
  }

  private scheduleLoadWhenNearViewport() {
    if (typeof IntersectionObserver === 'undefined') {
      void this.load();
      return;
    }

    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.intersectionObserver?.disconnect();
      this.intersectionObserver = null;
      void this.load();
    }, { rootMargin: '900px 0px' });
    this.intersectionObserver.observe(this.dom);
  }

  private readonly loadFromInteraction = () => {
    void this.load();
  };

  private async load() {
    if (this.loading || this.loadedView || this.destroyed) return;
    this.loading = true;
    const mod = await import('./CodeBlockNodeView');
    if (this.destroyed) return;

    const loadedView = new mod.CodeBlockNodeView(this.node, this.view, this.getPos);
    this.loadedView = loadedView;
    this.dom.replaceChildren(loadedView.dom);
    this.dom.removeEventListener('mousedown', this.loadFromInteraction);
    this.dom.removeEventListener('focusin', this.loadFromInteraction);
    delete this.dom.dataset.cmLazy;
  }

  update(node: Node) {
    this.node = node;
    if (this.loadedView?.update) {
      return this.loadedView.update(node);
    }

    const placeholder = this.dom.querySelector<HTMLPreElement>('.code-block-lazy-preview');
    if (placeholder) {
      placeholder.textContent = node.textContent;
    }
    return true;
  }

  selectNode() {
    this.loadedView?.selectNode?.();
  }

  deselectNode() {
    this.loadedView?.deselectNode?.();
  }

  setSelection(anchor: number, head: number, root: Document | ShadowRoot) {
    this.loadedView?.setSelection?.(anchor, head, root);
  }

  stopEvent(event: Event) {
    return this.loadedView?.stopEvent?.(event) ?? this.dom.contains(event.target as globalThis.Node);
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) {
    return this.loadedView?.ignoreMutation?.(mutation) ?? true;
  }

  destroy() {
    this.destroyed = true;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.dom.removeEventListener('mousedown', this.loadFromInteraction);
    this.dom.removeEventListener('focusin', this.loadFromInteraction);
    this.loadedView?.destroy?.();
    this.dom.remove();
  }
}
