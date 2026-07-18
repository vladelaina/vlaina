import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from './ChatInput';
import { FILE_TREE_CHAT_DROP_EVENT } from '@/components/Notes/features/FileTree/hooks/fileTreePointerDragState';
import { getDroppedExternalPaths } from '@/components/Notes/hooks/externalDropPayload';
import { setCurrentNotesRootPath, useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { actions as aiActions } from '@/stores/useAIStore';
import {
  publishComputerCommandApproval,
  resetComputerCommandApprovalsForTests,
} from '@/lib/ai/computerUse/approvalState';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/usePredictedTextareaHeight', () => ({
  usePredictedTextareaHeight: () => ({ syncHeight: vi.fn() }),
}));

vi.mock('@/lib/navigation/externalLinks', () => ({
  openExternalHref: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/billing/returnRefresh', () => ({
  markBillingReturnRefreshPending: vi.fn(),
}));

vi.mock('@/components/Notes/hooks/externalDropPayload', () => ({
  getDroppedExternalPaths: vi.fn(() => []),
}));

type ChatInputProps = ComponentProps<typeof ChatInput>;
const getDroppedExternalPathsMock = vi.mocked(getDroppedExternalPaths);

function getTestDisplayName(path: string): string {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path;
}

function renderChatInput(overrides: Partial<ChatInputProps> = {}) {
  const noop = vi.fn();
  const props: ChatInputProps = {
    active: true,
    onSend: vi.fn(),
    onStop: noop,
    isLoading: false,
    hasSelectedModel: true,
    sentUserMessages: [],
    ...overrides,
  };

  return {
    ...render(<ChatInput {...props} />),
    props,
  };
}

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetComputerCommandApprovalsForTests();
    getDroppedExternalPathsMock.mockReturnValue([]);
    setCurrentNotesRootPath(null);
    useNotesRootStore.setState({ currentNotesRoot: null });
    useNotesStore.setState({
      notesPath: '',
      getDisplayName: getTestDisplayName,
    });
    useUnifiedStore.setState((state) => ({
      loaded: false,
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          providers: [],
          models: [],
          selectedModelId: null,
          webSearchEnabled: false,
        },
      },
    }));
  });

  it('does not clear persisted web search while the selected model is unresolved', () => {
    useUnifiedStore.setState((state) => ({
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          webSearchEnabled: true,
        },
      },
    }));
    const setWebSearchEnabled = vi.spyOn(aiActions, 'setWebSearchEnabled').mockImplementation(() => {});

    renderChatInput();

    expect(setWebSearchEnabled).not.toHaveBeenCalled();
    setWebSearchEnabled.mockRestore();
  });

  it('disables web search for a verified model-level Anthropic endpoint', () => {
    useUnifiedStore.setState((state) => ({
      loaded: true,
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          providers: [{
            id: 'custom-provider',
            name: 'Custom provider',
            type: 'newapi',
            endpointType: 'openai',
            apiHost: 'https://api.example.test',
            apiKey: 'test-key',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          }],
          models: [{
            id: 'custom-model',
            apiModelId: 'custom-model',
            name: 'Custom model',
            providerId: 'custom-provider',
            endpointType: 'anthropic',
            endpointTypeCheckedAt: 1,
            enabled: true,
            createdAt: 1,
          }],
          selectedModelId: 'custom-model',
          webSearchEnabled: true,
        },
      },
    }));
    const setWebSearchEnabled = vi.spyOn(aiActions, 'setWebSearchEnabled').mockImplementation(() => {});

    renderChatInput();

    expect(setWebSearchEnabled).toHaveBeenCalledWith(false);
    setWebSearchEnabled.mockRestore();
  });

  it('disables web search for standalone image generation models', () => {
    useUnifiedStore.setState((state) => ({
      loaded: true,
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          providers: [{
            id: 'image-provider',
            name: 'Image provider',
            type: 'newapi',
            endpointType: 'openai',
            apiHost: 'https://api.example.test',
            apiKey: 'test-key',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          }],
          models: [{
            id: 'image-model',
            apiModelId: 'gpt-image-2',
            name: 'GPT Image 2',
            providerId: 'image-provider',
            enabled: true,
            createdAt: 1,
          }],
          selectedModelId: 'image-model',
          webSearchEnabled: true,
        },
      },
    }));
    const setWebSearchEnabled = vi.spyOn(aiActions, 'setWebSearchEnabled').mockImplementation(() => {});

    renderChatInput();

    expect(setWebSearchEnabled).toHaveBeenCalledWith(false);
    setWebSearchEnabled.mockRestore();
  });

  it('keeps the composer editable and lets submit retry quota refresh while managed quota is shown', async () => {
    const onSend = vi.fn(async () => false);

    renderChatInput({
      onSend,
      isManagedQuotaExhausted: true,
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'still editable' } });

    expect(textarea).not.toBeDisabled();
    expect(textarea.value).toBe('still editable');
    expect(screen.getByRole('button', { name: 'chat.openActions' })).not.toBeDisabled();

    const sendButton = screen.getByRole('button', { name: 'common.send' });
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).not.toHaveClass('opacity-[var(--vlaina-opacity-60)]');

    await act(async () => {
      fireEvent.click(sendButton);
      await Promise.resolve();
    });
    expect(onSend).toHaveBeenCalledWith('still editable', [], []);
    expect(textarea.value).toBe('still editable');
  });

  it('renders the managed quota notice as part of an expanded composer frame', () => {
    const { container } = renderChatInput({
      isManagedQuotaExhausted: true,
    });

    const banner = container.querySelector('[data-managed-quota-banner="true"]');
    const frame = container.querySelector('[data-chat-input="true"]')?.parentElement;
    expect(banner).not.toBeNull();
    expect(frame).toHaveClass('bg-[var(--vlaina-color-accent-soft)]');
    expect(frame).toHaveClass('overflow-hidden');
    expect(banner).toHaveClass('min-h-[var(--vlaina-size-32px)]');
    expect(banner).not.toHaveClass('absolute');
  });

  it('anchors computer command approval above the composer without changing its flow height', () => {
    publishComputerCommandApproval('approval-1', {
      command: 'uname -a',
      cwd: '/tmp/project',
      purpose: 'Inspect the system',
      timeoutSeconds: 600,
      risk: 'standard',
      canAlwaysAllow: true,
    });
    const { container } = renderChatInput();

    const approval = container.querySelector<HTMLElement>('[data-computer-command-approval="true"]');
    const approvalFrame = container.querySelector<HTMLElement>('[data-computer-command-approval-frame="true"]');
    const composer = container.querySelector<HTMLElement>('[data-chat-input="true"]');
    expect(approval).not.toBeNull();
    expect(approvalFrame).not.toBeNull();
    expect(composer).not.toBeNull();
    if (!approval || !approvalFrame || !composer) {
      throw new Error('Expected approval frame, approval controls, and composer elements.');
    }
    expect(approvalFrame).toContainElement(approval);
    expect(approvalFrame.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(approvalFrame).toHaveClass('absolute');
    expect(approvalFrame).toHaveClass('bottom-[var(--vlaina-offset-computer-command-approval)]');
    expect(approvalFrame).toHaveClass('bg-[var(--vlaina-color-accent-soft)]');
    expect(composer).toHaveClass('!shadow-none');
    expect(screen.getByRole('button', { name: 'chat.computerUse.runOnce' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chat.computerUse.alwaysRun' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    for (const button of screen.getAllByRole('button').filter((item) => [
      'chat.computerUse.runOnce',
      'chat.computerUse.alwaysRun',
      'common.cancel',
    ].includes(item.textContent || ''))) {
      expect(button).toHaveClass('!rounded-[var(--vlaina-radius-pill)]');
    }
  });

  it('keeps the approval overlay outside the quota frame clipping boundary', () => {
    publishComputerCommandApproval('approval-1', {
      command: 'uname -a',
      cwd: '/tmp/project',
      purpose: 'Inspect the system',
      timeoutSeconds: 600,
      risk: 'standard',
      canAlwaysAllow: true,
    });
    const { container } = renderChatInput({ isManagedQuotaExhausted: true });

    const approvalFrame = container.querySelector<HTMLElement>('[data-computer-command-approval-frame="true"]');
    const composer = container.querySelector<HTMLElement>('[data-chat-input="true"]');
    if (!approvalFrame || !composer?.parentElement) {
      throw new Error('Expected approval and quota frames.');
    }

    const quotaFrame = composer.parentElement;
    expect(quotaFrame).toHaveClass('overflow-hidden');
    expect(quotaFrame).not.toContainElement(approvalFrame);
    expect(approvalFrame.parentElement).toContainElement(quotaFrame);
  });

  it('does not show pending approval controls in an inactive chat input', () => {
    publishComputerCommandApproval('approval-1', {
      command: 'uname -a',
      cwd: '/tmp/project',
      purpose: 'Inspect the system',
      timeoutSeconds: 600,
      risk: 'standard',
      canAlwaysAllow: true,
    });
    const { container } = renderChatInput({ active: false });

    expect(container.querySelector('[data-computer-command-approval-frame="true"]')).toBeNull();
  });

  it('adds a note mention when a file tree item is dropped into chat', async () => {
    renderChatInput();

    act(() => {
      window.dispatchEvent(new CustomEvent(FILE_TREE_CHAT_DROP_EVENT, {
        detail: {
          path: 'docs/Source.md',
          kind: 'note',
        },
      }));
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Source ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Source');
  });

  it('opens the native file picker from the upload action', () => {
    const originalShowPicker = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'showPicker');
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    try {
      renderChatInput();

      fireEvent.click(screen.getByRole('button', { name: 'chat.openActions' }));
      fireEvent.click(screen.getByText('chat.uploadFile'));

      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      if (originalShowPicker) {
        Object.defineProperty(HTMLInputElement.prototype, 'showPicker', originalShowPicker);
      } else {
        Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
      }
    }
  });

  it('adds note mentions when opened folder markdown files are dropped into chat', async () => {
    getDroppedExternalPathsMock.mockReturnValue([
      '/notesRoot/docs/Source.md',
      '/notesRoot/docs/Source.md',
      '/notesRoot/docs/Skipped.txt',
      '/other-notesRoot/Outside.txt',
    ]);
    useNotesStore.setState({
      notesPath: '/notesRoot',
      getDisplayName: getTestDisplayName,
    });
    renderChatInput();

    const dropTarget = document.querySelector('[data-chat-input="true"]');
    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        files: [new File(['body'], 'Source.md', { type: 'text/markdown' })],
        items: [],
        types: ['Files'],
      },
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Source ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Source');
  });

  it('adds note mentions when external markdown files are dropped into chat', async () => {
    getDroppedExternalPathsMock.mockReturnValue(['/outside/Untitled.md']);
    useNotesStore.setState({
      notesPath: '/notesRoot',
      getDisplayName: getTestDisplayName,
    });
    renderChatInput();

    const dropTarget = document.querySelector('[data-chat-input="true"]');
    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        files: [new File(['body'], 'Untitled.md', { type: 'text/markdown' })],
        items: [],
        types: ['Files'],
      },
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Untitled ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Untitled');
  });

  it('uses the active opened folder path when the notes store path is not initialized yet', async () => {
    getDroppedExternalPathsMock.mockReturnValue(['/notesRoot/docs/Fallback.md']);
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notesRoot',
        name: 'NotesRoot',
        path: '/notesRoot',
        lastOpened: Date.now(),
      },
    });
    renderChatInput();

    const dropTarget = document.querySelector('[data-chat-input="true"]');
    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        files: [new File(['body'], 'Fallback.md', { type: 'text/markdown' })],
        items: [],
        types: ['Files'],
      },
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Fallback ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Fallback');
  });
});
