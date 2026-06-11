import { useEffect } from 'react';
import { useLinkState, UseLinkStateProps } from './hooks/useLinkState';
import { LinkEditor } from './components/LinkEditor';
import { LinkViewer } from './components/LinkViewer';

export interface LinkTooltipProps extends UseLinkStateProps {
    onOpen: () => void;
    onUnlink: () => void;
    onRemove: () => void;
}

const LinkTooltip = (props: LinkTooltipProps) => {
    const {
        mode, setMode,
        isAutolink,
        editUrl, setEditUrl,
        editText, setEditText,
        handleSaveEdit,
        handleCancelEdit,
        handleCopy,
        showCopied,
        displayUrl,
        isNewLink,
        autoFocus,
        invalidUrlAttempt
    } = useLinkState(props);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const container = document.querySelector('.link-tooltip-container');
            if (container && container.contains(event.target as Node)) {
                return;
            }

            const target = event.target instanceof Element ? event.target : null;
            if (!target) {
                return;
            }

            if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[role="menu"]')) {
                return;
            }

            if (mode === 'edit') {
                const didSave = handleSaveEdit(true);
                if (!didSave) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            } else {
                props.onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
        };
    }, [mode, handleSaveEdit, props.onClose]);


    if (mode === 'edit') {
        return (
            <LinkEditor
                editUrl={editUrl}
                setEditUrl={setEditUrl}
                editText={editText}
                setEditText={setEditText}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                isNewLink={isNewLink}
                autoFocus={autoFocus}
                initialText={props.initialText || ''}
                invalidUrlAttempt={invalidUrlAttempt}
            />
        );
    }

    return (
        <LinkViewer
            displayUrl={displayUrl}
            isAutolink={isAutolink}
            showCopied={showCopied}
            onOpen={props.onOpen}
            onCopy={handleCopy}
            onEdit={() => setMode('edit')}
            onUnlink={props.onUnlink}
            onRemove={props.onRemove}
        />
    );
};

export default LinkTooltip;
