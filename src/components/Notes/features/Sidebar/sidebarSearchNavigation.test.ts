import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentEditorViewMock: vi.fn(),
  getEditorFindStateMock: vi.fn(),
  setEditorFindActiveIndexMock: vi.fn(),
  setEditorFindQueryMock: vi.fn(),
}));

vi.mock('../Editor/utils/editorViewRegistry', () => ({
  getCurrentEditorView: mocks.getCurrentEditorViewMock,
}));

vi.mock('../Editor/plugins/find', () => ({
  getEditorFindState: mocks.getEditorFindStateMock,
  setEditorFindActiveIndex: mocks.setEditorFindActiveIndexMock,
  setEditorFindQuery: mocks.setEditorFindQueryMock,
}));

import { applySidebarSearchNavigation } from './sidebarSearchNavigation';

describe('sidebarSearchNavigation', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('applies the find query and jumps to the requested match ordinal', async () => {
    const view = { id: 'view' };
    mocks.getCurrentEditorViewMock.mockReturnValue(view);
    mocks.getEditorFindStateMock.mockReturnValue({
      matches: [{ from: 1, to: 3 }, { from: 5, to: 7 }, { from: 9, to: 11 }],
    });

    const applied = await applySidebarSearchNavigation({
      query: 'alpha',
      contentMatchOrdinal: 2,
    });

    expect(applied).toBe(true);
    expect(mocks.setEditorFindQueryMock).toHaveBeenCalledWith(view, 'alpha');
    expect(mocks.setEditorFindActiveIndexMock).toHaveBeenCalledWith(view, 2);
  });

  it('clamps the requested match ordinal to the available match count', async () => {
    const view = { id: 'view' };
    mocks.getCurrentEditorViewMock.mockReturnValue(view);
    mocks.getEditorFindStateMock.mockReturnValue({
      matches: [{ from: 1, to: 3 }],
    });

    await applySidebarSearchNavigation({
      query: 'alpha',
      contentMatchOrdinal: 99,
    });

    expect(mocks.setEditorFindActiveIndexMock).toHaveBeenCalledWith(view, 0);
  });

  it('only sets the query when the result has no content match ordinal', async () => {
    const view = { id: 'view' };
    mocks.getCurrentEditorViewMock.mockReturnValue(view);

    await applySidebarSearchNavigation({
      query: 'alpha',
      contentMatchOrdinal: null,
    });

    expect(mocks.setEditorFindQueryMock).toHaveBeenCalledWith(view, 'alpha');
    expect(mocks.setEditorFindActiveIndexMock).not.toHaveBeenCalled();
  });
});
