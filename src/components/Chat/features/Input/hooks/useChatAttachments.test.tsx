import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { deleteAttachment, saveAttachment } from '@/lib/storage/attachmentStorage';
import {
  MAX_CHAT_ATTACHMENT_INPUT_FILES,
  MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN,
  useChatAttachments,
} from './useChatAttachments';

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

function createFileList(files: File[]): FileList {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    ...files,
  } as unknown as FileList;
}

function createClipboardItems(files: File[]): DataTransferItemList {
  const items: Array<DataTransferItem | undefined> = files.map((file) => ({
    getAsFile: () => file,
    getAsString: () => {},
    kind: 'file',
    type: file.type,
    webkitGetAsEntry: () => null,
  } as unknown as DataTransferItem));
  items.length = MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN + 20;
  return {
    length: items.length,
    add: vi.fn(),
    clear: vi.fn(),
    item: (index: number) => items[index] ?? null,
    remove: vi.fn(),
    ...items,
  } as unknown as DataTransferItemList;
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

  it('limits oversized file selections before saving attachments', async () => {
    const files: File[] = [];
    for (let index = 0; index < MAX_CHAT_ATTACHMENT_INPUT_FILES + 5; index += 1) {
      files.push(new File(['image'], `photo-${index}.png`, { type: 'image/png' }));
    }
    mocks.saveAttachment.mockImplementation(async (file: File) => createAttachment({
      id: file.name,
      name: file.name,
    }));
    const { result } = renderHook(() => useChatAttachments());

    await act(async () => {
      await result.current.handleFileChange({
        target: {
          files: createFileList(files),
          value: 'selected',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(saveAttachment).toHaveBeenCalledTimes(MAX_CHAT_ATTACHMENT_INPUT_FILES);
    expect(saveAttachment).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: `photo-${MAX_CHAT_ATTACHMENT_INPUT_FILES - 1}.png` }),
      { persist: true }
    );
    expect(result.current.attachments).toHaveLength(MAX_CHAT_ATTACHMENT_INPUT_FILES);
  });

  it('limits clipboard item scans and accepted attachment files', async () => {
    const files: File[] = [];
    for (let index = 0; index < MAX_CHAT_ATTACHMENT_INPUT_FILES + 20; index += 1) {
      files.push(new File(['image'], `paste-${index}.png`, { type: 'image/png' }));
    }
    mocks.saveAttachment.mockImplementation(async (file: File) => createAttachment({
      id: file.name,
      name: file.name,
    }));
    const preventDefault = vi.fn();
    const { result } = renderHook(() => useChatAttachments());

    await act(async () => {
      await result.current.handlePaste({
        clipboardData: {
          items: createClipboardItems(files),
        },
        preventDefault,
      } as unknown as React.ClipboardEvent);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(saveAttachment).toHaveBeenCalledTimes(MAX_CHAT_ATTACHMENT_INPUT_FILES);
    expect(saveAttachment).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: `paste-${MAX_CHAT_ATTACHMENT_INPUT_FILES - 1}.png` }),
      { persist: true }
    );
    expect(result.current.attachments).toHaveLength(MAX_CHAT_ATTACHMENT_INPUT_FILES);
  });
});
