import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { openExternalHref, normalizeExternalHref } from '@/lib/navigation/externalLinks';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { dispatchOpenMarkdownTargetEvent } from '../../../../OpenTarget/openTargetEvents';

function getPathWithoutFragmentOrQuery(href: string): string {
    const hashIndex = href.indexOf('#');
    const queryIndex = href.indexOf('?');
    const endIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
    return href.slice(0, endIndexes.length > 0 ? Math.min(...endIndexes) : href.length);
}

function scrollToCurrentEditorFragment(view: EditorView | null | undefined, fragment: string): boolean {
    let decodedFragment = '';
    try {
        decodedFragment = decodeURIComponent(fragment.replace(/^#/, '')).trim();
    } catch {
        return false;
    }
    if (!decodedFragment || !view) return false;

    const escapedFragment = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(decodedFragment)
        : decodedFragment.replace(/["\\]/g, '\\$&');
    const target = view.dom.querySelector<HTMLElement>(
        `#${escapedFragment}, [name="${escapedFragment}"], [data-heading-id="${escapedFragment}"]`,
    );
    if (!target) return false;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus?.({ preventScroll: true });
    return true;
}

export async function resolveEditorMarkdownLinkTarget(href: string): Promise<string | null> {
    const safeHref = sanitizeNoteLinkHref(href);
    if (!safeHref || safeHref.startsWith('//') || normalizeExternalHref(safeHref)) return null;

    const linkPath = getPathWithoutFragmentOrQuery(safeHref).trim();
    if (!linkPath || !isSupportedMarkdownPath(linkPath)) return null;

    const { notesPath, currentNote } = useNotesStore.getState();
    const currentNotePath = currentNote?.path;

    if (isAbsolutePath(linkPath)) {
        if (!notesPath) return null;
        return normalizeContainedAssetPath(await joinPath(notesPath, linkPath.replace(/^[/\\]+/, '')), notesPath);
    }

    if (currentNotePath && isAbsolutePath(currentNotePath)) {
        const currentDir = getParentPath(currentNotePath);
        return currentDir ? await joinPath(currentDir, linkPath) : null;
    }

    if (!notesPath) return null;

    const currentNoteDir = currentNotePath ? getParentPath(currentNotePath) : null;
    const basePath = currentNoteDir ? await joinPath(notesPath, currentNoteDir) : notesPath;
    const candidate = normalizeContainedAssetPath(await joinPath(basePath, linkPath), notesPath);
    if (candidate) return candidate;

    return null;
}

export async function openEditorLinkHref(
    href: string | null | undefined,
    options: { view?: EditorView | null } = {},
): Promise<void> {
    const trimmed = href?.trim() ?? '';
    if (!trimmed) return;

    if (normalizeExternalHref(trimmed)) {
        await openExternalHref(trimmed);
        return;
    }

    if (trimmed.startsWith('#')) {
        scrollToCurrentEditorFragment(options.view, trimmed);
        return;
    }

    const target = await resolveEditorMarkdownLinkTarget(trimmed);
    if (target) {
        dispatchOpenMarkdownTargetEvent(target);
    }
}
