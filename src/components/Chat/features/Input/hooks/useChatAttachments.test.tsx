import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { deleteAttachment, saveAttachment } from '@/lib/storage/attachmentStorage';
import { useChatAttachments } from './useChatAttachments';

const mocks = vi.hoisted(() => ({
  deleteAttachment: vi.fn(),
  saveAttachment: vi.fn(),
  temporaryChatEnabled: false,
}));

vi.mock('@/lib/storage/attachmentStorage', () => ({
  deleteAttachment: mocks.deleteAttachment,
  saveAttachment: mocks.saveAttachment,
}));

vi.mock('@/stores/ai/chatState', () => ({
  useAIUIStore: {
    getState: () => ({
      temporaryChatEnabled: mocks.temporaryChatEnabled,
    }),
  },
}));

function createAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    path: '',
    previewUrl: 'data:image/png;base64,AQID',
    assetUrl: '',
    name: 'photo.png',
    type: 'image/png',
    size: 3,
    ...overrides,
  };
}

describe('useChatAttachments', () => {
  beforeEach(() => {
    mocks.deleteAttachment.mockReset();
    mocks.saveAttachment.mockReset();
    mocks.temporaryChatEnabled = false;
  });

  it('keeps accepted files and ignores rejected attachments', async () => {
    const accepted = createAttachment();
    mocks.saveAttachment
      .mockResolvedValueOnce(accepted)
      .mockRejectedValueOnce(new Error('Unsupported attachment type'));
    const { result } = renderHook(() => useChatAttachments());

    await act(async () => {
      await result.current.handleFileChange({
        target: {
          files: [
            new File(['image'], 'photo.png', { type: 'image/png' }),
            new File(['text'], 'note.txt', { type: 'text/plain' }),
          ],
          value: 'selected',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(saveAttachment).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'photo.png' }), { persist: true });
    expect(saveAttachment).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'note.txt' }), { persist: true });
    expect(result.current.attachments).toEqual([accepted]);
  });

  it('keeps temporary chat attachments in memory', async () => {
    mocks.temporaryChatEnabled = true;
    mocks.saveAttachment.mockResolvedValueOnce(createAttachment());
    const { result } = renderHook(() => useChatAttachments());

    await act(async () => {
      await result.current.handleFileChange({
        target: {
          files: [new File(['image'], 'photo.png', { type: 'image/png' })],
          value: 'selected',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(saveAttachment).toHaveBeenCalledWith(expect.objectContaining({ name: 'photo.png' }), { persist: false });
  });

  it('deletes pending attachment files when the user removes them before sending', async () => {
    const first = createAttachment({ id: 'first', path: '/appdata/.vlaina/attachments/first.png' });
    const second = createAttachment({ id: 'second', path: '/appdata/.vlaina/attachments/second.png' });
    mocks.saveAttachment
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const { result } = renderHook(() => useChatAttachments());

    await act(async () => {
      await result.current.handleFileChange({
        target: {
          files: [
            new File(['first'], 'first.png', { type: 'image/png' }),
            new File(['second'], 'second.png', { type: 'image/png' }),
          ],
          value: 'selected',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      result.current.removeAttachment('first');
    });

    expect(result.current.attachments).toEqual([second]);
    expect(deleteAttachment).toHaveBeenCalledTimes(1);
    expect(deleteAttachment).toHaveBeenCalledWith(first);
  });

  it('does not delete attachment files when clearing after a successful send', async () => {
    const sent = createAttachment({ id: 'sent', path: '/appdata/.vlaina/attachments/sent.png' });
    mocks.saveAttachment.mockResolvedValueOnce(sent);
    const { result } = renderHook(() => useChatAttachments());

    await act(async () => {
      await result.current.handleFileChange({
        target: {
          files: [new File(['sent'], 'sent.png', { type: 'image/png' })],
          value: 'selected',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      result.current.clearAttachments();
    });

    expect(result.current.attachments).toEqual([]);
    expect(deleteAttachment).not.toHaveBeenCalled();
  });
});
