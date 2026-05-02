import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';

const { useNotesStoreMock } = vi.hoisted(() => ({
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
  useNotesStore: (selector: (state: any) => unknown) => useNotesStoreMock(selector({
    rootFolder: null,
    currentNote: null,
    notesPath: '',
    isLoading: false,
    loadFileTree: vi.fn(),
    getDisplayName: (path: string) => path,
  })),
}));

vi.mock('@/components/Chat/common/LocalImage', () => ({
  LocalImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('@/components/Chat/common/messageClipboard', () => ({
  copyMessageContentToClipboard: vi.fn(async () => {}),
  extractMarkdownImageSources: vi.fn(() => []),
  stripMarkdownImageTokens: vi.fn((value: string) => value),
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
    versions: [{ content, createdAt: timestamp, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe('UserMessage', () => {
  beforeEach(() => {
    useNotesStoreMock.mockClear();
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
});
