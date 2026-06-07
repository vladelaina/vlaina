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

    it('resolves supported markdown extension variants', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.markdown'))
            .resolves.toBe('/vault/daily/guide/setup.markdown');
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.mdown'))
            .resolves.toBe('/vault/daily/guide/setup.mdown');
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.mkd'))
            .resolves.toBe('/vault/daily/guide/setup.mkd');
    });

    it('resolves percent-encoded markdown paths relative to the current note folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide%20setup.md'))
            .resolves.toBe('/vault/daily/guide setup.md');
        await expect(resolveEditorMarkdownLinkTarget('guide%2Fsetup.md'))
            .resolves.toBe('/vault/daily/guide/setup.md');
    });

    it('keeps literal percent text in markdown link paths', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide%ZZ.md'))
            .resolves.toBe('/vault/daily/guide%ZZ.md');
    });

    it('resolves root-relative markdown paths inside the current vault', async () => {
        await expect(resolveEditorMarkdownLinkTarget('/docs/setup.md#install'))
            .resolves.toBe('/vault/docs/setup.md');
    });

    it('rejects relative markdown paths that escape the current vault', async () => {
        await expect(resolveEditorMarkdownLinkTarget('../../secret.md'))
            .resolves.toBeNull();
    });

    it('rejects encoded markdown paths that escape the current vault', async () => {
        await expect(resolveEditorMarkdownLinkTarget('%2e%2e%2f%2e%2e%2fsecret.md'))
            .resolves.toBeNull();
    });

    it('rejects encoded external markdown URLs', async () => {
        await expect(resolveEditorMarkdownLinkTarget('https%3A%2F%2Fexample.com%2Fdocs.md'))
            .resolves.toBeNull();
    });

    it('rejects explicit URL schemes even when they look like markdown paths', async () => {
        await expect(resolveEditorMarkdownLinkTarget('http://127.0.0.1/secret.md'))
            .resolves.toBeNull();
        await expect(resolveEditorMarkdownLinkTarget('https://example.com/docs.md'))
            .resolves.toBeNull();
    });

    it('keeps absolute current-note relative links contained by the vault', async () => {
        mocks.notesState.currentNote = { path: '/vault/daily/today.md' };

        await expect(resolveEditorMarkdownLinkTarget('../guide/setup.md'))
            .resolves.toBe('/vault/guide/setup.md');
        await expect(resolveEditorMarkdownLinkTarget('../../secret.md'))
            .resolves.toBeNull();
    });

    it('keeps external absolute current-note relative links beside the note directory', async () => {
        mocks.notesState.currentNote = { path: '/external/daily/today.md' };

        await expect(resolveEditorMarkdownLinkTarget('./guide/setup.md'))
            .resolves.toBe('/external/daily/guide/setup.md');
        await expect(resolveEditorMarkdownLinkTarget('../secret.md'))
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

    it('ignores oversized markdown link paths before resolving them', async () => {
        await expect(resolveEditorMarkdownLinkTarget(`${'a'.repeat(16 * 1024)}.md`))
            .resolves.toBeNull();

        await openEditorLinkHref(`${'a'.repeat(16 * 1024)}.md`);

        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
        expect(mocks.openExternalHref).not.toHaveBeenCalled();
    });

    it('ignores oversized same-note fragments before querying the editor DOM', async () => {
        const view = {
            dom: {
                querySelector: vi.fn(),
            },
        };

        await openEditorLinkHref(`#${'a'.repeat(2048)}`, { view: view as never });

        expect(view.dom.querySelector).not.toHaveBeenCalled();
        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
        expect(mocks.openExternalHref).not.toHaveBeenCalled();
    });
});
