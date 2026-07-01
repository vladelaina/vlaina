import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCachedDesktopUpdateInfo, writeCachedDesktopUpdateInfo } from '@/lib/desktop/updateStatus';
import { SettingsModal } from './SettingsModal';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: {
      children: ReactNode;
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/common/BlurBackdrop', () => ({
  BlurBackdrop: () => <div data-testid="blur-backdrop" />,
}));

vi.mock('@/components/common/DialogCloseIconButton', () => ({
  DialogCloseIconButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" aria-label={label} onClick={onClick} />
  ),
}));

vi.mock('@/hooks/useWindowDragGesture', () => ({
  useWindowDragGesture: () => ({
    beginWindowDragTracking: vi.fn(),
    stopWindowDragTracking: vi.fn(),
  }),
}));

vi.mock('./hooks/useModalBehavior', () => ({
  useModalBehavior: vi.fn(),
}));

vi.mock('./tabs/AboutTab', () => ({
  AboutTab: () => <div data-testid="about-tab" />,
}));

vi.mock('./tabs/MarkdownTab', () => ({
  MarkdownTab: () => <div data-testid="markdown-tab" />,
}));

vi.mock('./tabs/AppearanceTab', () => ({
  AppearanceTab: () => <div data-testid="appearance-tab" />,
}));

vi.mock('./tabs/AITab', () => ({
  AITab: () => <div data-testid="ai-tab" />,
}));

vi.mock('./tabs/LanguageTab', () => ({
  LanguageTab: () => <div data-testid="language-tab" />,
}));

vi.mock('@/stores/ai/providerActions', () => ({
  actions: {
    deleteIncompleteCustomProviders: vi.fn(),
  },
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'common.close': 'Close',
      'settings.general': 'General',
      'settings.tabs.markdown': 'Markdown',
      'settings.tabs.ai': 'AI',
      'settings.tabs.appearance': 'Appearance',
      'settings.tabs.language': 'Language',
      'settings.tabs.about': 'About',
      'settings.updateIndicator': 'Update',
      'settings.about.updateAction': 'Update',
    }[key] ?? key),
  }),
}));

const communitySettings = {
  qqGroupNumber: '',
  qqQrCodeText: '',
  wechatQrCodeText: '',
};

function setScrollMetrics(
  element: HTMLElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop?: number },
) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => metrics.clientHeight,
  });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => metrics.scrollHeight,
  });

  let currentScrollTop = metrics.scrollTop ?? 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
  });
}

describe('SettingsModal', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('marks the About tab when a cached desktop update is available', async () => {
    writeCachedDesktopUpdateInfo({
      currentVersion: '0.1.16',
      latestVersion: '99.99.99',
      updateAvailable: true,
      downloadUrl: 'https://github.com/vladelaina/vlaina/releases/download/v99.99.99/vlaina-99.99.99-linux-x86_64.AppImage',
      releaseUrl: 'https://github.com/vladelaina/vlaina/releases/tag/v99.99.99',
      platformAssetName: 'vlaina-99.99.99-linux-x86_64.AppImage',
      hasPlatformAsset: true,
      releaseNotes: '',
      publishedAt: '2026-06-27T00:00:00.000Z',
    });

    render(
      <SettingsModal
        open
        communitySettings={communitySettings}
        onClose={vi.fn()}
      />,
    );

    const aboutTab = screen.getByRole('button', { name: /About Update/ });
    expect(aboutTab).toHaveAttribute('data-settings-tab', 'about');
    expect(document.querySelector('[data-desktop-update-indicator="badge"]')).toHaveTextContent('Update');

    act(() => {
      clearCachedDesktopUpdateInfo();
    });

    await waitFor(() => {
      expect(document.querySelector('[data-desktop-update-indicator="badge"]')).toBeNull();
    });
  });

  it('handles wheel scrolling on the settings content root', () => {
    render(
      <SettingsModal
        open
        communitySettings={communitySettings}
        onClose={vi.fn()}
      />,
    );

    const scrollRoot = document.querySelector('[data-settings-scroll-root="content"]') as HTMLElement | null;
    expect(scrollRoot).not.toBeNull();

    setScrollMetrics(scrollRoot!, { clientHeight: 200, scrollHeight: 800, scrollTop: 0 });
    fireEvent.wheel(scrollRoot!, { deltaY: 160 });

    expect(scrollRoot!.scrollTop).toBe(160);
  });

  it('handles wheel scrolling on the settings sidebar root', () => {
    render(
      <SettingsModal
        open
        communitySettings={communitySettings}
        onClose={vi.fn()}
      />,
    );

    const scrollRoot = document.querySelector('[data-settings-scroll-root="sidebar"]') as HTMLElement | null;
    expect(scrollRoot).not.toBeNull();

    setScrollMetrics(scrollRoot!, { clientHeight: 120, scrollHeight: 360, scrollTop: 10 });
    fireEvent.wheel(scrollRoot!, { deltaY: 80 });

    expect(scrollRoot!.scrollTop).toBe(90);
  });
});
