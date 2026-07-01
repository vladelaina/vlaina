import type { ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
    }[key] ?? key),
  }),
}));

const communitySettings = {
  qqGroupNumber: '',
  qqQrCodeText: '',
  wechatQrCodeText: '',
};

describe('SettingsModal update indicator', () => {
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

    const aboutTab = screen.getByRole('button', { name: /About v99\.99\.99/ });
    expect(aboutTab).toHaveAttribute('data-settings-tab', 'about');
    expect(document.querySelector('[data-settings-update-indicator="about"]')).toHaveTextContent('v99.99.99');

    act(() => {
      clearCachedDesktopUpdateInfo();
    });

    await waitFor(() => {
      expect(document.querySelector('[data-settings-update-indicator="about"]')).toBeNull();
    });
  });
});
