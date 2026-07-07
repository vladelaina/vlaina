export type FloatingToolbarReviewToolbarEntry = {
  element: HTMLElement;
  renderer: {
    destroy: () => void;
    render: (...args: any[]) => void;
  };
  lastRenderState: string;
};

export type FloatingToolbarPluginViewContext = Record<string, any> & {
  reviewToolbars: Map<string, FloatingToolbarReviewToolbarEntry>;
};
