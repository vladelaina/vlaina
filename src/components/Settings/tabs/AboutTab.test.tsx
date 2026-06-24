import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutTab } from './AboutTab';

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => undefined,
}));

vi.mock('@/lib/navigation/externalLinks', () => ({
  getExternalLinkProps: (href: string) => ({ href }),
  openExternalHref: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: (key: string, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'common.check': 'Check',
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
        'settings.about.updates': 'Updates',
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
});
