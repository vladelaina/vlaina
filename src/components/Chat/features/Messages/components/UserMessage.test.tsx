import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS } from '@/lib/ui/composerFocusRegistry';

const { notesStoreState, useNotesStoreMock } = vi.hoisted(() => ({
  notesStoreState: {
    rootFolder: null,
    currentNote: null,
    notesPath: '',
    isLoading: false,
    starredEntries: [],
    loadFileTree: vi.fn(),
    getDisplayName: (path: string) => path,
    getNoteIcon: () => undefined,
  },
  useNotesStoreMock: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => useNotesStoreMock(selector(notesStoreState)),
}));

vi.mock('@/components/Chat/common/LocalImage', () => ({
  LocalImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('@/components/Chat/common/messageClipboard', () => ({
  MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES: 2000,
  MAX_CHAT_MESSAGE_IMAGE_SOURCES: 1000,
  copyMessageContentToClipboard: vi.fn(async () => {}),
  extractMarkdownImageSources: vi.fn(() => []),
  extractRenderedMarkdownImageSources: vi.fn(() => []),
  extractRenderedMessageImageSources: vi.fn(() => []),
  isRenderedImageSource: vi.fn(() => true),
  normalizeRenderedMessageImageSources: vi.fn((value: string[] | undefined) => value ?? []),
  stripMarkdownImageTokens: vi.fn((value: string) => value),
  stripMessageImageTokens: vi.fn((value: string) => value),
}));

vi.mock('@/lib/navigation/externalLinks', () => ({
  normalizeExternalHref: vi.fn(() => null),
  openExternalHref: vi.fn(async () => {}),
}));

import { UserMessage } from './UserMessage';

function createMessage(): ChatMessage {
  const content = 'Draft the launch checklist';
  const timestamp = Date.now();
  return {
    id: 'u1',
    role: 'user',
    content,
    modelId: 'model-a',
    timestamp,
    versions: [{ content, createdAt: timestamp, kind: 'original' as const, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe('UserMessage', () => {
  beforeEach(() => {
    useNotesStoreMock.mockClear();
    useNotesStoreMock.mockImplementation((selectedValue: unknown) => selectedValue);
  });

  it('does not subscribe to notes state while only rendering display mode', () => {
    render(<UserMessage message={createMessage()} containerWidth={880} onEdit={vi.fn()} />);

    expect(screen.getByText('Draft the launch checklist')).toBeInTheDocument();
    expect(useNotesStoreMock).not.toHaveBeenCalled();
  });

  it('subscribes to notes state after entering edit mode', () => {
    render(<UserMessage message={createMessage()} containerWidth={880} onEdit={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]!);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(useNotesStoreMock).toHaveBeenCalled();
  });

  it('limits edited message text before saving', () => {
    const onEdit = vi.fn();
    const { container } = render(<UserMessage message={createMessage()} containerWidth={880} onEdit={onEdit} />);
    const oversizedMessage = 'x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS + 1);

    fireEvent.click(screen.getByLabelText('Edit message'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: {
        value: oversizedMessage,
        selectionStart: oversizedMessage.length,
      },
    });

    expect(textarea.value).toBe('x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS));

    const saveButton = container.querySelector('[data-chat-message-editor-action="save"]');
    expect(saveButton).not.toBeNull();
    fireEvent.click(saveButton!);

    expect(onEdit).toHaveBeenCalledWith('u1', 'x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS));
  });

  it('uses the dark-theme accent treatment for the edit send button in light mode', () => {
    const { container } = render(<UserMessage message={createMessage()} containerWidth={880} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Edit message'));

    const saveButton = container.querySelector('[data-chat-message-editor-action="save"]');
    expect(saveButton).not.toBeNull();
    expect(saveButton?.className).toContain('bg-[#41a8ea]');
    expect(saveButton?.className).toContain('text-[length:var(--vlaina-font-13)]');
    expect(saveButton?.className).toContain('text-[#ffffff]');
    expect(saveButton?.className).toContain('rgba(65,168,234,0.16)');
    expect(saveButton?.className).not.toContain('dark:bg-');
  });

  it('does not render the hover toolbar while waiting for an assistant response', () => {
    render(
      <UserMessage
        message={createMessage()}
        containerWidth={880}
        isAwaitingResponse
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uses the shared compact version navigator for editable prompt versions', () => {
    const onSwitchVersion = vi.fn();
    const message = {
      ...createMessage(),
      content: 'Second prompt',
      currentVersionIndex: 1,
      versions: [
        { content: 'First prompt', createdAt: 1, kind: 'original' as const, subsequentMessages: [] },
        { content: 'Second prompt', createdAt: 2, kind: 'edit' as const, subsequentMessages: [] },
        { content: 'Third prompt', createdAt: 3, kind: 'edit' as const, subsequentMessages: [] },
      ],
    };

    render(
      <UserMessage
        message={message}
        containerWidth={880}
        onEdit={vi.fn()}
        onSwitchVersion={onSwitchVersion}
      />,
    );

    expect(screen.getByText('2/3')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);

    expect(onSwitchVersion).toHaveBeenNthCalledWith(1, 'u1', 0);
    expect(onSwitchVersion).toHaveBeenNthCalledWith(2, 'u1', 2);
  });
});
