import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

// ============================================================================
// Heading Plugin - Simplified
// ============================================================================
// Only protects the first H1 from deletion.
// All heading formatting is now handled by the floating toolbar.

/**
 * Prevents deletion of the document title (First H1).
 */
const protectFirstH1Plugin = $prose(() => {
    return new Plugin({
        key: new PluginKey('protectFirstH1'),
        props: {
            handleKeyDown(view, event) {
                const { selection, doc } = view.state;
                const { from, empty } = selection;
                const firstNode = doc.firstChild;

                if (!firstNode || firstNode.type.name !== 'heading') return false;
                if (event.key === 'Backspace' && empty && from === 1) return true;

                return false;
            }
        }
    });
});

export const headingPlugin = [
    protectFirstH1Plugin
];
