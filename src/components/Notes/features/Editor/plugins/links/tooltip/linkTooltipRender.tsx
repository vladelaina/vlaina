import type { EditorView } from '@milkdown/kit/prose/view';
import type { Root } from 'react-dom/client';
import LinkTooltip from './LinkTooltip';
import { getBoundedLinkTooltipText } from './linkTooltipTransactions';
import { openEditorLinkHref } from '../utils/openEditorLinkHref';

interface RenderExistingLinkTooltipArgs {
    root: Root | null;
    view: EditorView;
    containerElement: HTMLElement;
    link: HTMLElement;
    href: string;
    onEdit: (text: string, url: string, shouldClose?: boolean) => void;
    onUnlink: () => void;
    onRemove: () => void;
    onClose: () => void;
}

export function renderExistingLinkTooltip({
    root,
    view,
    containerElement,
    link,
    href,
    onEdit,
    onUnlink,
    onRemove,
    onClose,
}: RenderExistingLinkTooltipArgs) {
    root?.render(
        <LinkTooltip
            key={Date.now()}
            href={href}
            initialText={getBoundedLinkTooltipText(link)}
            containerElement={containerElement}
            onOpen={() => void openEditorLinkHref(href, { view })}
            onEdit={onEdit}
            onUnlink={onUnlink}
            onRemove={onRemove}
            onClose={onClose}
        />
    );
}

interface RenderNewLinkTooltipArgs {
    root: Root | null;
    containerElement: HTMLElement;
    selectedText: string;
    autoFocus: boolean;
    onEdit: (text: string, url: string, shouldClose?: boolean) => void;
    onRemove: () => void;
    onClose: () => void;
}

export function renderNewLinkTooltip({
    root,
    containerElement,
    selectedText,
    autoFocus,
    onEdit,
    onRemove,
    onClose,
}: RenderNewLinkTooltipArgs) {
    root?.render(
        <LinkTooltip
            key={Date.now()}
            href=""
            initialText={selectedText}
            autoFocus={autoFocus}
            containerElement={containerElement}
            onOpen={() => { }}
            onEdit={onEdit}
            onUnlink={() => { }}
            onRemove={onRemove}
            onClose={onClose}
        />
    );
}
