import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { writeTextToClipboard } from '@/lib/clipboard';
import { useLinkState } from './useLinkState';

vi.mock('@/lib/clipboard', () => ({
    writeTextToClipboard: vi.fn(),
}));

const writeTextToClipboardMock = vi.mocked(writeTextToClipboard);

describe('useLinkState', () => {
    beforeEach(() => {
        writeTextToClipboardMock.mockReset();
        writeTextToClipboardMock.mockResolvedValue(true);
    });

    it('copies autolink URLs without markdown-escaped scheme separators', async () => {
        const { result } = renderHook(() => useLinkState({
            href: 'http\\://example.test:8317',
            initialText: 'http\\://example.test:8317',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        await act(async () => {
            result.current.handleCopy();
        });

        expect(writeTextToClipboardMock).toHaveBeenCalledWith('http://example.test:8317');
    });

    it('copies markdown links with normalized hrefs', async () => {
        const { result } = renderHook(() => useLinkState({
            href: 'https\\://example.com',
            initialText: 'Example',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        await act(async () => {
            result.current.handleCopy();
        });

        expect(writeTextToClipboardMock).toHaveBeenCalledWith('[Example](https://example.com)');
    });
});
