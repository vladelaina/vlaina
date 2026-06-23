import { describe, expect, it, vi } from 'vitest';
import { ImageBlockNodeView } from './ImageBlockNodeView';

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: mocks.render,
    unmount: mocks.unmount,
  }),
}));

vi.mock('./ImageBlockView', () => ({
  ImageBlockView: () => null,
}));

vi.mock('@/styles/themeTokens', () => ({
  themeImageBlockStyleTokens: {
    displayBlock: 'block',
    widthFull: '100%',
    maxWidthFull: '100%',
  },
}));

function createImageNode(attrs: Record<string, unknown> = {}) {
  return {
    type: { name: 'image' },
    attrs: {
      src: './assets/demo.png',
      alt: 'demo',
      ...attrs,
    },
  };
}

async function flushMicrotasks() {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

describe('ImageBlockNodeView', () => {
  it('lets ProseMirror own DOM removal when the node view is destroyed', async () => {
    const nodeView = new ImageBlockNodeView(
      createImageNode() as never,
      {} as never,
      () => 1,
    );
    document.body.appendChild(nodeView.dom);

    nodeView.destroy();

    expect(document.body.contains(nodeView.dom)).toBe(true);
    await flushMicrotasks();
    expect(mocks.unmount).toHaveBeenCalledTimes(1);
    nodeView.dom.remove();
  });
});
