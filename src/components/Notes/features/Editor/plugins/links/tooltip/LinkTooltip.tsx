import { useEffect, useRef } from 'react';
import { useLinkState, UseLinkStateProps } from './hooks/useLinkState';
import { LinkEditor } from './components/LinkEditor';
import { LinkViewer } from './components/LinkViewer';

export interface LinkTooltipProps extends UseLinkStateProps {
    onOpen: () => void;
    onUnlink: () => void;
    onRemove: () => void;
}

const LinkTooltip = (props: LinkTooltipProps) => {
    const skipNextMouseDownRef = useRef(false);
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
        const handlePressOutside = (event: MouseEvent | PointerEvent) => {
            if (event.type === 'mousedown' && skipNextMouseDownRef.current) {
                skipNextMouseDownRef.current = false;
                return;
            }

            const container = props.containerElement ?? document.querySelector('.link-tooltip-container');
            if (container && container.contains(event.target as Node)) {
                return;
            }

            const target = event.target instanceof Element
                ? event.target
                : event.target instanceof Node
                    ? event.target.parentElement
                    : null;

            if (target?.closest('[data-radix-popper-content-wrapper]') || target?.closest('[role="menu"]')) {
                return;
            }

            if (event.type === 'pointerdown') {
                skipNextMouseDownRef.current = true;
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

        document.addEventListener('pointerdown', handlePressOutside, true);
        document.addEventListener('mousedown', handlePressOutside, true);
        return () => {
            document.removeEventListener('pointerdown', handlePressOutside, true);
            document.removeEventListener('mousedown', handlePressOutside, true);
        };
    }, [mode, handleSaveEdit, props.containerElement, props.onClose]);


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
