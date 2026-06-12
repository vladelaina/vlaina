import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MentionPreviewOverlay } from './MentionPreviewOverlay';
import type { MentionPreviewPart } from '../noteMentionHelpers';

const mentionPart: MentionPreviewPart = {
  key: 'mention:0',
  type: 'mention',
  text: '@Today',
  start: 0,
  end: 6,
  mention: {
    path: '/notes/today.md',
    title: 'Today',
    kind: 'note',
  },
};

const archiveMentionPart: MentionPreviewPart = {
  key: 'mention:archive',
  type: 'mention',
  text: '@Archive',
  start: 7,
  end: 15,
  mention: {
    path: '/notes/archive.md',
    title: 'Archive',
    kind: 'note',
  },
};

describe('MentionPreviewOverlay', () => {
  it('renders mention tokens with the sidebar selected row treatment', () => {
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[mentionPart]}
        textareaScrollTop={0}
        onFocusMentionEnd={vi.fn()}
        onRemoveMention={vi.fn()}
      />
    );

    const token = container.querySelector('[data-mention-preview-token="true"]');
    const surface = container.querySelector('[data-mention-preview-token-surface="true"]');
    const removeButton = container.querySelector('[data-mention-preview-remove="true"]');

    expect(token).not.toBeNull();
    expect(token).toHaveClass('text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(surface).not.toBeNull();
    expect(surface).toHaveClass('rounded-full');
    expect(surface).toHaveClass('bg-[var(--vlaina-sidebar-chat-row-active)]');
    expect(token).not.toHaveClass('bg-[var(--vlaina-accent)]');
    expect(token).not.toHaveClass('text-[var(--vlaina-color-white)]');
    expect(removeButton).toHaveClass('absolute');
    expect(removeButton).toHaveClass('-right-1');
    expect(removeButton).toHaveClass('-top-1');
  });

  it('uses the following space as the token right padding so the native caret lands outside it', () => {
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[
          mentionPart,
          {
            key: 'text:space',
            type: 'text',
            text: ' after',
            start: 6,
            end: 12,
          },
        ]}
        textareaScrollTop={0}
        onFocusMentionEnd={vi.fn()}
        onRemoveMention={vi.fn()}
      />
    );

    const token = container.querySelector('[data-mention-preview-token="true"]');
    const surface = container.querySelector('[data-mention-preview-token-surface="true"]');
    expect(token?.textContent?.replace('×', '')).toBe('@Today ');
    expect(surface).toHaveClass('left-0');
    expect(surface).not.toHaveClass('-left-0.5');
    expect(surface).not.toHaveClass('-left-1.5');
    expect(container.textContent?.replace('×', '')).toBe('@Today after');
  });

  it('keeps the separator space between adjacent mention tokens', () => {
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[
          mentionPart,
          {
            key: 'text:separator',
            type: 'text',
            text: ' ',
            start: 6,
            end: 7,
          },
          archiveMentionPart,
        ]}
        textareaScrollTop={0}
        onFocusMentionEnd={vi.fn()}
        onRemoveMention={vi.fn()}
      />
    );

    const tokens = container.querySelectorAll('[data-mention-preview-token="true"]');
    expect(tokens[0]?.textContent?.replace('×', '')).toBe('@Today');
    expect(tokens[1]?.textContent?.replace('×', '')).toBe('@Archive');
    expect(container.textContent?.replaceAll('×', '')).toBe('@Today @Archive');
  });

  it('removes a mention from the inline control', () => {
    const onRemoveMention = vi.fn();
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[mentionPart]}
        textareaScrollTop={0}
        onFocusMentionEnd={vi.fn()}
        onRemoveMention={onRemoveMention}
      />
    );

    const removeButton = container.querySelector('[data-mention-preview-remove="true"]');
    expect(removeButton).not.toBeNull();

    fireEvent.click(removeButton as Element);

    expect(onRemoveMention).toHaveBeenCalledWith('/notes/today.md', 0, 6);
  });

  it('removes the trailing insertion space from the inline control', () => {
    const onRemoveMention = vi.fn();
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[
          mentionPart,
          {
            key: 'text:space',
            type: 'text',
            text: ' after',
            start: 6,
            end: 12,
          },
        ]}
        textareaScrollTop={0}
        onFocusMentionEnd={vi.fn()}
        onRemoveMention={onRemoveMention}
      />
    );

    const removeButton = container.querySelector('[data-mention-preview-remove="true"]');
    expect(removeButton).not.toBeNull();

    fireEvent.click(removeButton as Element);

    expect(onRemoveMention).toHaveBeenCalledWith('/notes/today.md', 0, 7);
  });

  it('requests caret placement after the token when the token body is pressed', () => {
    const onFocusMentionEnd = vi.fn();
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[mentionPart]}
        textareaScrollTop={0}
        onFocusMentionEnd={onFocusMentionEnd}
        onRemoveMention={vi.fn()}
      />
    );

    const token = container.querySelector('[data-mention-preview-token="true"]');
    expect(token).not.toBeNull();

    fireEvent.mouseDown(token as Element);

    expect(onFocusMentionEnd).toHaveBeenCalledWith(6);
  });

  it('requests caret placement after the trailing insertion space when present', () => {
    const onFocusMentionEnd = vi.fn();
    const { container } = render(
      <MentionPreviewOverlay
        mentionPreviewParts={[
          mentionPart,
          {
            key: 'text:space',
            type: 'text',
            text: ' after',
            start: 6,
            end: 12,
          },
        ]}
        textareaScrollTop={0}
        onFocusMentionEnd={onFocusMentionEnd}
        onRemoveMention={vi.fn()}
      />
    );

    const token = container.querySelector('[data-mention-preview-token="true"]');
    expect(token).not.toBeNull();

    fireEvent.mouseDown(token as Element);

    expect(onFocusMentionEnd).toHaveBeenCalledWith(7);
  });
});
