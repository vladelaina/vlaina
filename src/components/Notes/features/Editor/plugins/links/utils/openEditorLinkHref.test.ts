import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    openEditorLinkHref,
    resolveEditorMarkdownLinkTarget,
} from './openEditorLinkHref';

const mocks = vi.hoisted(() => ({
    dispatchOpenMarkdownTargetEvent: vi.fn(),
    openExternalHref: vi.fn(),
    notesState: {
        notesPath: '/vault',
        currentNote: { path: 'daily/today.md' },
    },
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
    useNotesStore: {
        getState: () => mocks.notesState,
    },
}));

vi.mock('../../../../OpenTarget/openTargetEvents', () => ({
    dispatchOpenMarkdownTargetEvent: (path: string) => mocks.dispatchOpenMarkdownTargetEvent(path),
}));

vi.mock('@/lib/navigation/externalLinks', () => ({
    normalizeExternalHref: (href: string | null | undefined) => {
        if (!href) return null;
        return /^(https?:\/\/|mailto:)/i.test(href.trim()) ? href.trim() : null;
    },
    openExternalHref: (href: string | null | undefined) => mocks.openExternalHref(href),
}));

describe('openEditorLinkHref', () => {
    beforeEach(() => {
        mocks.notesState = {
            notesPath: '/vault',
            currentNote: { path: 'daily/today.md' },
        };
        mocks.dispatchOpenMarkdownTargetEvent.mockClear();
        mocks.openExternalHref.mockClear();
    });

    it('opens external links with the external link handler', async () => {
        await openEditorLinkHref('https://example.com/docs');

        expect(mocks.openExternalHref).toHaveBeenCalledWith('https://example.com/docs');
        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
    });

    it('resolves markdown paths relative to the current note folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.md'))
            .resolves.toBe('/vault/daily/guide/setup.md');
    });

    it('resolves root-relative markdown paths inside the current vault', async () => {
        await expect(resolveEditorMarkdownLinkTarget('/docs/setup.md#install'))
            .resolves.toBe('/vault/docs/setup.md');
    });

    it('rejects relative markdown paths that escape the current vault', async () => {
        await expect(resolveEditorMarkdownLinkTarget('../../secret.md'))
            .resolves.toBeNull();
    });

    it('dispatches the markdown open event for resolved note links', async () => {
        await openEditorLinkHref('./guide/setup.md#install');

        expect(mocks.dispatchOpenMarkdownTargetEvent).toHaveBeenCalledWith('/vault/daily/guide/setup.md');
        expect(mocks.openExternalHref).not.toHaveBeenCalled();
    });

    it('ignores non-markdown relative links instead of sending them to the external opener', async () => {
        await openEditorLinkHref('./image.png');

        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
        expect(mocks.openExternalHref).not.toHaveBeenCalled();
    });
});
