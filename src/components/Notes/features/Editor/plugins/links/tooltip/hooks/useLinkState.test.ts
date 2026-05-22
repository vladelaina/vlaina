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

    it('displays the complete normalized href', () => {
        const { result } = renderHook(() => useLinkState({
            href: 'https\\://www.example.com/docs/page?tab=api#section',
            initialText: 'Example',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        expect(result.current.displayUrl).toBe('https://www.example.com/docs/page?tab=api#section');
    });

    it('keeps the user-facing bare domain text for autolinks', () => {
        const { result } = renderHook(() => useLinkState({
            href: 'https://cati.me',
            initialText: 'cati.me',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        expect(result.current.isAutolink).toBe(true);
        expect(result.current.displayUrl).toBe('cati.me');
        expect(result.current.editUrl).toBe('cati.me');
    });

    it('copies autolinks using the user-facing text', async () => {
        const { result } = renderHook(() => useLinkState({
            href: 'https://cati.me',
            initialText: 'cati.me',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        await act(async () => {
            result.current.handleCopy();
        });

        expect(writeTextToClipboardMock).toHaveBeenCalledWith('cati.me');
    });

    it('copies markdown links as normalized hrefs', async () => {
        const { result } = renderHook(() => useLinkState({
            href: 'https\\://example.com',
            initialText: 'Example',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        await act(async () => {
            result.current.handleCopy();
        });

        expect(writeTextToClipboardMock).toHaveBeenCalledWith('https://example.com');
    });

    it('copies mailto email links as plain email addresses', async () => {
        const { result } = renderHook(() => useLinkState({
            href: 'mailto:v.lad.el.a.ina@gmail.com',
            initialText: 'v.lad.el.a.ina@gmail.com',
            onEdit: vi.fn(),
            onClose: vi.fn(),
        }));

        await act(async () => {
            result.current.handleCopy();
        });

        expect(writeTextToClipboardMock).toHaveBeenCalledWith('v.lad.el.a.ina@gmail.com');
    });
});
