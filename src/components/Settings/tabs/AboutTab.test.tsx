import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutTab } from './AboutTab';

const { electronBridgeMock, openExternalHrefMock } = vi.hoisted(() => ({
  electronBridgeMock: { current: undefined as unknown },
  openExternalHrefMock: vi.fn(),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => electronBridgeMock.current,
}));

vi.mock('@/lib/navigation/externalLinks', () => ({
  getExternalLinkProps: (href: string) => ({ href }),
  openExternalHref: openExternalHrefMock,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: (key: string, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'common.check': 'Check',
        'common.checkFailed': 'Check failed',
        'common.checking': 'Checking',
        'common.open': 'Open',
        'settings.about.discord': 'Discord',
        'settings.about.github': 'GitHub',
        'settings.about.openDiscord': 'Open Discord',
        'settings.about.openGithub': 'Open GitHub',
        'settings.about.openPrivacyPolicy': 'Open privacy policy',
        'settings.about.openSlack': 'Open Slack',
        'settings.about.openWebsite': 'Open website',
        'settings.about.privacy': 'Privacy',
        'settings.about.qqGroup': 'QQ group',
        'settings.about.slack': 'Slack',
        'settings.about.updateAction': 'Update',
        'settings.about.updateAvailable': `v${String(values?.version ?? '')} available`,
        'settings.about.updates': 'Updates',
        'settings.about.upToDate': 'Up to date',
        'settings.about.wechatGroup': 'WeChat group',
      };

      return messages[key] ?? String(values?.version ?? key);
    },
  }),
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: (selector: (state: { isConnected: boolean }) => unknown) =>
    selector({ isConnected: false }),
}));

vi.mock('qrcode', () => ({
  toString: vi.fn().mockResolvedValue('<svg />'),
}));

describe('AboutTab community QR pills', () => {
  afterEach(() => {
    cleanup();
    electronBridgeMock.current = undefined;
    vi.clearAllMocks();
  });

  it('shows only one community QR panel when moving between QQ and WeChat', () => {
    const { container } = render(
      <AboutTab
        community={{
          qqGroupNumber: '123456',
          qqQrCodeText: 'qq-code',
          wechatQrCodeText: 'wechat-code',
        }}
      />,
    );

    const qqPill = screen.getByRole('button', { name: 'QQ group' }).closest('[data-community-qr-pill="qq"]');
    const wechatPill = screen.getByRole('button', { name: 'WeChat group' }).closest('[data-community-qr-pill="wechat"]');
    const qqPanel = container.querySelector('[data-community-qr-panel="qq"]');
    const wechatPanel = container.querySelector('[data-community-qr-panel="wechat"]');

    expect(qqPill).not.toBeNull();
    expect(wechatPill).not.toBeNull();
    expect(qqPanel).not.toBeNull();
    expect(wechatPanel).not.toBeNull();

    fireEvent.mouseEnter(qqPill as Element);

    expect(qqPanel).toHaveClass('opacity-[var(--vlaina-opacity-100)]');
    expect(wechatPanel).not.toHaveClass('opacity-[var(--vlaina-opacity-100)]');

    fireEvent.mouseEnter(wechatPill as Element);

    expect(qqPanel).not.toHaveClass('opacity-[var(--vlaina-opacity-100)]');
    expect(wechatPanel).toHaveClass('opacity-[var(--vlaina-opacity-100)]');
  });

  it('opens the platform-specific update package URL returned by the desktop updater', async () => {
    const downloadUrl = 'https://github.com/vladelaina/vlaina/releases/download/v0.1.17/vlaina-0.1.17-linux-x86_64.AppImage';
    electronBridgeMock.current = {
      app: {
        getVersion: vi.fn().mockResolvedValue('0.1.16'),
      },
      update: {
        check: vi.fn().mockResolvedValue({
          currentVersion: '0.1.16',
          latestVersion: '0.1.17',
          updateAvailable: true,
          downloadUrl,
          releaseUrl: 'https://github.com/vladelaina/vlaina/releases/tag/v0.1.17',
          platformAssetName: 'vlaina-0.1.17-linux-x86_64.AppImage',
          hasPlatformAsset: true,
          releaseNotes: 'Release notes',
          publishedAt: '2026-06-26T00:00:00.000Z',
        }),
      },
    };

    render(
      <AboutTab
        community={{
          qqGroupNumber: '123456',
          qqQrCodeText: 'qq-code',
          wechatQrCodeText: 'wechat-code',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    const updateButton = await screen.findByRole('button', { name: 'Update' });
    expect(updateButton).toHaveAttribute('title', 'vlaina-0.1.17-linux-x86_64.AppImage');
    expect(updateButton.className).toContain('bg-[var(--vlaina-sidebar-row-selected-bg)]');
    expect(updateButton.className).toContain('text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(updateButton.className).toContain('shadow-[var(--vlaina-shadow-selection-soft)]');
    expect(updateButton.className).not.toContain('border');

    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(openExternalHrefMock).toHaveBeenCalledWith(downloadUrl);
    });
  });
});
