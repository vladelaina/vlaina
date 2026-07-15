import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMilkdownThemeRuntime } from './useMilkdownThemeRuntime';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/components/markdown-theme/useImportedMarkdownThemePlatform', () => ({
  useImportedMarkdownThemePlatform: () => null,
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: (selector: (state: unknown) => unknown) => selector({
    data: {
      settings: {
        ui: { colorMode: 'system' },
        markdown: {
          appearance: { importedThemeId: null },
          typewriterMode: false,
        },
      },
    },
  }),
}));

afterEach(() => {
  document.body.replaceChildren();
});

describe('useMilkdownThemeRuntime', () => {
  it('styles a ProseMirror root inserted after the inactive editor shell mounts', async () => {
    const shell = document.createElement('div');
    document.body.append(shell);
    const editorShellRef = { current: shell };

    const hook = renderHook(() => useMilkdownThemeRuntime({
      activatedRevision: 0,
      editorShellRef,
    }));

    const editorRoot = document.createElement('div');
    editorRoot.className = 'ProseMirror';
    shell.append(editorRoot);

    await waitFor(() => {
      expect(editorRoot).toHaveAttribute('data-markdown-theme-root', 'true');
    });
    expect(editorRoot).toHaveAttribute('data-markdown-compat-layer', 'native');
    expect(editorRoot).toHaveClass('theme-vlaina', 'theme-light', 'is-desktop');

    hook.unmount();
  });
});
