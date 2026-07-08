import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    openEditorLinkHref,
    resolveEditorMarkdownLinkTarget,
} from './openEditorLinkHref';

const mocks = vi.hoisted(() => ({
    dispatchOpenMarkdownTargetEvent: vi.fn(),
    openExternalHref: vi.fn(),
    notesState: {
        notesPath: '/notesRoot',
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
        return /^(https?:\/\/|mailto:|weixin:)/i.test(href.trim()) ? href.trim() : null;
    },
    openExternalHref: (href: string | null | undefined) => mocks.openExternalHref(href),
}));

describe('openEditorLinkHref', () => {
    beforeEach(() => {
        mocks.notesState = {
            notesPath: '/notesRoot',
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

    it('opens weixin links with the external link handler', async () => {
        await openEditorLinkHref('weixin://');

        expect(mocks.openExternalHref).toHaveBeenCalledWith('weixin://');
        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
    });

    it('resolves markdown paths relative to the current note folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.md'))
            .resolves.toBe('/notesRoot/daily/guide/setup.md');
    });

    it('resolves supported markdown extension variants', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.markdown'))
            .resolves.toBe('/notesRoot/daily/guide/setup.markdown');
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.mdown'))
            .resolves.toBe('/notesRoot/daily/guide/setup.mdown');
        await expect(resolveEditorMarkdownLinkTarget('guide/setup.mkd'))
            .resolves.toBe('/notesRoot/daily/guide/setup.mkd');
    });

    it('resolves percent-encoded markdown paths relative to the current note folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide%20setup.md'))
            .resolves.toBe('/notesRoot/daily/guide setup.md');
        await expect(resolveEditorMarkdownLinkTarget('guide%2Fsetup.md'))
            .resolves.toBe('/notesRoot/daily/guide/setup.md');
    });

    it('keeps literal percent text in markdown link paths', async () => {
        await expect(resolveEditorMarkdownLinkTarget('guide%ZZ.md'))
            .resolves.toBe('/notesRoot/daily/guide%ZZ.md');
    });

    it('resolves root-relative markdown paths inside the opened folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('/docs/setup.md#install'))
            .resolves.toBe('/notesRoot/docs/setup.md');
    });

    it('allows user dot-folder markdown links inside the opened folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('/.notes/setup.md'))
            .resolves.toBe('/notesRoot/.notes/setup.md');
        await expect(resolveEditorMarkdownLinkTarget('../.journal.md'))
            .resolves.toBe('/notesRoot/.journal.md');
    });

    it('rejects links into internal notes folders', async () => {
        await expect(resolveEditorMarkdownLinkTarget('/.vlaina/workspace.md'))
            .resolves.toBeNull();
        await expect(resolveEditorMarkdownLinkTarget('/docs/.git/config.md'))
            .resolves.toBeNull();
        await expect(resolveEditorMarkdownLinkTarget('/.VLAINA/workspace.md'))
            .resolves.toBeNull();
        await expect(resolveEditorMarkdownLinkTarget('/docs/.GIT/config.md'))
            .resolves.toBeNull();
        await expect(resolveEditorMarkdownLinkTarget('/%2evlaina/workspace.md'))
            .resolves.toBeNull();
        await expect(resolveEditorMarkdownLinkTarget('/docs/%2egit/config.md'))
            .resolves.toBeNull();
    });

    it('rejects relative markdown paths that escape the opened folder', async () => {
        await expect(resolveEditorMarkdownLinkTarget('../../secret.md'))
            .resolves.toBeNull();
    });

    it('rejects encoded markdown paths that escape the opened folder', async () => {
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

    it('keeps absolute current-note relative links contained by the notesRoot', async () => {
        mocks.notesState.currentNote = { path: '/notesRoot/daily/today.md' };

        await expect(resolveEditorMarkdownLinkTarget('../guide/setup.md'))
            .resolves.toBe('/notesRoot/guide/setup.md');
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

        expect(mocks.dispatchOpenMarkdownTargetEvent).toHaveBeenCalledWith('/notesRoot/daily/guide/setup.md');
        expect(mocks.openExternalHref).not.toHaveBeenCalled();
    });

    it('jumps to same-note fragments without smooth scrolling', async () => {
        const target = document.createElement('h2');
        const scrollIntoView = vi.fn();
        const focus = vi.fn();
        target.id = 'install';
        target.scrollIntoView = scrollIntoView;
        target.focus = focus;

        const view = {
            dom: document.createElement('div'),
        };
        view.dom.append(target);

        await openEditorLinkHref('#install', { view: view as never });

        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
        expect(mocks.openExternalHref).not.toHaveBeenCalled();
    });

    it('opens safe non-markdown relative links as browser searches', async () => {
        await openEditorLinkHref('./image.png');
        await openEditorLinkHref('/docs/image.png');

        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
        expect(mocks.openExternalHref).toHaveBeenNthCalledWith(
            1,
            'https://www.google.com/search?q=.%2Fimage.png',
        );
        expect(mocks.openExternalHref).toHaveBeenNthCalledWith(
            2,
            'https://www.google.com/search?q=%2Fdocs%2Fimage.png',
        );
    });

    it('opens plain non-url hrefs as browser searches', async () => {
        await openEditorLinkHref('workspace-note');
        await openEditorLinkHref('1');

        expect(mocks.dispatchOpenMarkdownTargetEvent).not.toHaveBeenCalled();
        expect(mocks.openExternalHref).toHaveBeenNthCalledWith(
            1,
            'https://www.google.com/search?q=workspace-note',
        );
        expect(mocks.openExternalHref).toHaveBeenNthCalledWith(
            2,
            'https://www.google.com/search?q=1',
        );
    });

    it('does not use browser search fallback for unsafe hrefs', async () => {
        await openEditorLinkHref('javascript:alert(1)');
        await openEditorLinkHref('obsidian://open?vault=demo');
        await openEditorLinkHref('//example.com/path');
        await openEditorLinkHref(String.raw`https\://example.com`);
        await openEditorLinkHref('.vlaina/workspace.md');

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
