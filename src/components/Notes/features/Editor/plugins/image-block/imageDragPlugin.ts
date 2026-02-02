/**
 * Image Drag Plugin - Manages drag placeholder decoration for image reordering
 *
 * This plugin creates a visual placeholder at the drop target position
 * when dragging images within the editor.
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, EditorView } from '@milkdown/kit/prose/view';

// Plugin key for external access
export const imageDragPluginKey = new PluginKey<ImageDragState>('imageDragPlugin');

interface ImageDragState {
    // The position of the node being dragged
    sourcePos: number | null;
    // The target position for the placeholder (insertion point)
    targetPos: number | null;
    // Whether we're currently dragging
    isDragging: boolean;
    // The height of the source image for placeholder sizing
    sourceHeight: number;
}

const initialState: ImageDragState = {
    sourcePos: null,
    targetPos: null,
    isDragging: false,
    sourceHeight: 100,
};

/**
 * Updates the drag state and triggers a view update
 */
export function setDragState(view: EditorView, state: Partial<ImageDragState>) {
    console.log('[ImageDrag] setDragState:', state);
    const tr = view.state.tr.setMeta(imageDragPluginKey, state);
    view.dispatch(tr);
}

/**
 * Clears the drag state
 */
export function clearDragState(view: EditorView) {
    setDragState(view, {
        sourcePos: null,
        targetPos: null,
        isDragging: false,
    });
}

/**
 * Gets the current drag state
 */
export function getDragState(view: EditorView): ImageDragState {
    return imageDragPluginKey.getState(view.state) || initialState;
}

/**
 * Calculates the best insertion position based on mouse coordinates
 * Returns the position where a new block should be inserted
 *
 * Note: Images in Milkdown are typically inside paragraphs (P > Image structure),
 * so sourcePos points to the image inside a paragraph. We need to handle this
 * by finding the parent paragraph's position.
 */
export function calculateDropPosition(view: EditorView, clientY: number, sourcePos: number): number | null {
    const { state } = view;
    const { doc } = state;

    // Resolve sourcePos to find the parent paragraph
    const $sourcePos = doc.resolve(sourcePos);
    const sourceParentPos = $sourcePos.before($sourcePos.depth);
    const sourceParentNode = $sourcePos.node($sourcePos.depth);
    const sourceParentEndPos = sourceParentPos + sourceParentNode.nodeSize;

    console.log('[ImageDrag] calculateDropPosition called:', {
        clientY,
        sourcePos,
        sourceParentPos,
        sourceParentEndPos,
        docSize: doc.content.size
    });

    // Get all top-level block positions (excluding source block)
    const blockPositions: { pos: number; top: number; bottom: number; nodeSize: number }[] = [];

    doc.forEach((node, offset) => {
        // Skip the source block entirely
        if (offset === sourceParentPos) return;

        const dom = view.nodeDOM(offset) as HTMLElement | null;
        if (dom) {
            const rect = dom.getBoundingClientRect();
            blockPositions.push({
                pos: offset,
                top: rect.top,
                bottom: rect.bottom,
                nodeSize: node.nodeSize,
            });
        }
    });

    console.log('[ImageDrag] Non-source blocks:', blockPositions.length);
    blockPositions.forEach((b, i) => {
        console.log(`  Block ${i}: pos=${b.pos}, nodeSize=${b.nodeSize}, top=${Math.round(b.top)}, bottom=${Math.round(b.bottom)}, mid=${Math.round((b.top + b.bottom) / 2)}`);
    });

    if (blockPositions.length === 0) {
        console.log('[ImageDrag] No other blocks to drop to');
        return null;
    }

    // Find blocks before and after the source
    const blocksBefore = blockPositions.filter(b => b.pos < sourceParentPos);
    const blocksAfter = blockPositions.filter(b => b.pos >= sourceParentEndPos);

    console.log('[ImageDrag] Blocks before source:', blocksBefore.length, 'Blocks after source:', blocksAfter.length);

    // Get the source block's visual bounds (approximate from adjacent blocks)
    const sourceTop = blocksBefore.length > 0
        ? blocksBefore[blocksBefore.length - 1].bottom
        : 0;
    const sourceBottom = blocksAfter.length > 0
        ? blocksAfter[0].top
        : window.innerHeight;

    console.log('[ImageDrag] Source visual bounds: top=', Math.round(sourceTop), 'bottom=', Math.round(sourceBottom));

    // If cursor is above the source block area, find the right spot in blocks before
    if (clientY < sourceTop && blocksBefore.length > 0) {
        // Find which block the cursor is over or closest to
        for (let i = blocksBefore.length - 1; i >= 0; i--) {
            const block = blocksBefore[i];
            const midPoint = Math.max(0, (block.top + block.bottom) / 2); // Clamp midPoint to viewport

            console.log(`[ImageDrag] Checking before-block ${i}: clientY=${clientY} vs block.top=${Math.round(block.top)}, bottom=${Math.round(block.bottom)}, midPoint=${Math.round(midPoint)}`);

            if (clientY < block.top) {
                // Cursor is above this block entirely
                continue;
            }

            // Cursor is within or below this block
            if (clientY < midPoint || (midPoint <= 0 && clientY < block.bottom)) {
                // Insert before this block
                console.log('[ImageDrag] Insert before block at pos:', block.pos);
                return block.pos;
            } else {
                // Insert after this block
                const targetPos = block.pos + block.nodeSize;
                console.log('[ImageDrag] Insert after block at pos:', targetPos);
                return targetPos;
            }
        }
        // Cursor is above all blocks - insert at the very beginning
        console.log('[ImageDrag] Insert at document start: 0');
        return 0;
    }

    // If cursor is below the source block area, find the right spot in blocks after
    if (clientY > sourceBottom && blocksAfter.length > 0) {
        for (let i = 0; i < blocksAfter.length; i++) {
            const block = blocksAfter[i];
            const midPoint = (block.top + block.bottom) / 2;

            console.log(`[ImageDrag] Checking after-block ${i}: clientY=${clientY} vs midPoint=${Math.round(midPoint)}`);

            if (clientY < midPoint) {
                // Insert before this block
                console.log('[ImageDrag] Insert before block at pos:', block.pos);
                return block.pos;
            }
        }
        // Cursor is below all blocks - insert at the end
        const lastBlock = blocksAfter[blocksAfter.length - 1];
        const endPos = lastBlock.pos + lastBlock.nodeSize;
        console.log('[ImageDrag] Insert at document end:', endPos);
        return endPos;
    }

    // Cursor is within the source block's area
    // Use the midpoint of source area to decide direction
    const sourceMidPoint = (sourceTop + sourceBottom) / 2;
    console.log('[ImageDrag] Cursor within source area, sourceMidPoint:', Math.round(sourceMidPoint));

    if (clientY < sourceMidPoint && blocksBefore.length > 0) {
        // Upper half of source area - target the position before source (end of last block before)
        const lastBlockBefore = blocksBefore[blocksBefore.length - 1];
        const targetPos = lastBlockBefore.pos + lastBlockBefore.nodeSize;
        console.log('[ImageDrag] Upper half, insert after last block before at pos:', targetPos);
        // This would be right before the source, which is a no-op - skip
        // Instead, try to move to before the last block before
        if (blocksBefore.length > 1) {
            const targetPos = lastBlockBefore.pos;
            console.log('[ImageDrag] Upper half, insert before last block before at pos:', targetPos);
            return targetPos;
        }
        // Only one block before - insert at start
        console.log('[ImageDrag] Upper half, only one block before, insert at start: 0');
        return 0;
    }

    if (clientY >= sourceMidPoint && blocksAfter.length > 0) {
        // Lower half of source area - target the position after source (start of first block after)
        const firstBlockAfter = blocksAfter[0];
        // This would be right after the source, which is a no-op - skip
        // Instead, try to move to after the first block after
        if (blocksAfter.length > 1) {
            const targetPos = firstBlockAfter.pos + firstBlockAfter.nodeSize;
            console.log('[ImageDrag] Lower half, insert after first block after at pos:', targetPos);
            return targetPos;
        }
        // Only one block after - insert at end
        const targetPos = firstBlockAfter.pos + firstBlockAfter.nodeSize;
        console.log('[ImageDrag] Lower half, only one block after, insert at end:', targetPos);
        return targetPos;
    }

    console.log('[ImageDrag] No valid drop target found');
    return null;
}

/**
 * Creates the placeholder widget decoration
 */
function createPlaceholderDecoration(pos: number, height: number): Decoration {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-drag-placeholder';
    placeholder.style.cssText = `
        height: ${Math.min(height, 60)}px;
        margin: 8px 0;
        border: 3px dashed var(--neko-accent, #3b82f6);
        border-radius: 8px;
        background: rgba(59, 130, 246, 0.2);
        transition: all 0.15s ease-out;
    `;

    console.log('[ImageDrag] Created placeholder element at pos:', pos);

    return Decoration.widget(pos, placeholder, {
        side: -1, // Insert before the position
        key: 'image-drag-placeholder'
    });
}

/**
 * The main plugin that manages drag state and decorations
 */
export const imageDragPlugin = $prose(() => {
    return new Plugin({
        key: imageDragPluginKey,

        state: {
            init(): ImageDragState {
                return { ...initialState };
            },

            apply(tr, value): ImageDragState {
                const meta = tr.getMeta(imageDragPluginKey);
                if (meta) {
                    return { ...value, ...meta };
                }
                return value;
            }
        },

        props: {
            decorations(state) {
                const pluginState = imageDragPluginKey.getState(state);

                if (!pluginState?.isDragging) {
                    return DecorationSet.empty;
                }

                console.log('[ImageDrag] decorations called with dragging=true, targetPos:', pluginState.targetPos);

                if (pluginState.targetPos === null) {
                    console.log('[ImageDrag] targetPos is null, no decoration');
                    return DecorationSet.empty;
                }

                // Validate target position is within document
                if (pluginState.targetPos < 0 || pluginState.targetPos > state.doc.content.size) {
                    console.log('[ImageDrag] targetPos out of bounds:', pluginState.targetPos, 'docSize:', state.doc.content.size);
                    return DecorationSet.empty;
                }

                console.log('[ImageDrag] ✓ Creating decoration at pos:', pluginState.targetPos, 'height:', pluginState.sourceHeight);
                const decoration = createPlaceholderDecoration(
                    pluginState.targetPos,
                    pluginState.sourceHeight
                );

                return DecorationSet.create(state.doc, [decoration]);
            }
        }
    });
});
