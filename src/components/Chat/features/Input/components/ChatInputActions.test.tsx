import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInputActions } from './ChatInputActions';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

function renderActions(overrides: Partial<Parameters<typeof ChatInputActions>[0]> = {}) {
  const noop = vi.fn();
  return render(
    <ChatInputActions
      onTriggerFileSelect={noop}
      onTriggerMentionSelect={noop}
      isLoading={false}
      canSend={false}
      canSubmit={false}
      webSearchEnabled={false}
      onToggleWebSearch={noop}
      onRequestComposerFocus={noop}
      onStop={noop}
      onSend={noop}
      {...overrides}
    />
  );
}

describe('ChatInputActions', () => {
  it('shows the add actions button background before hover', () => {
    renderActions();

    const addButton = screen.getByRole('button', { name: 'chat.openActions' });

    expect(addButton.className).toContain('!bg-[var(--vlaina-color-pill-surface-hover)]');
    expect(addButton.className).toContain('!shadow-[var(--vlaina-shadow-menu-hover)]');
    expect(addButton.className).toContain('text-[var(--vlaina-accent)]');
    expect(addButton.className).toContain('hover:text-[var(--vlaina-accent-hover)]');
  });

  it('keeps the empty send button in the app accent treatment instead of gray', () => {
    renderActions();

    const sendButton = screen.getByRole('button', { name: '' });

    expect(sendButton).toBeDisabled();
    expect(sendButton.className).toContain('bg-[var(--vlaina-color-pill-surface-hover)]');
    expect(sendButton.className).toContain('text-[var(--vlaina-accent)]');
    expect(sendButton.className).toContain('opacity-[var(--vlaina-opacity-45)]');
    expect(sendButton.className).toContain('shadow-[var(--vlaina-shadow-menu-hover)]');
    expect(sendButton.className).not.toContain('text-[var(--vlaina-color-text-soft)]');
  });
});
