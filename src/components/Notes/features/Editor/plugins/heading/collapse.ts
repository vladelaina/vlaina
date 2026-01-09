import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';

export const collapsePluginKey = new PluginKey('collapse-heading');

function getHeadingLevel(node: Node): number {
    return node.attrs.level || 0;
}

export const collapsePlugin = new Plugin({
    key: collapsePluginKey,
    state: {
        init() {
            // Set of start positions of folded headings
            return { folded: new Set<number>() };
        },
        apply(tr, value, oldState, newState) {
            const action = tr.getMeta(collapsePluginKey);
            // Map existing positions to new positions
            const newFolded = new Set<number>();
            value.folded.forEach(pos => {
                const result = tr.mapping.mapResult(pos);
                // Only keep if the node at the new position is still a heading
                // (Strictly, we should check logic, but basic mapping works for now)
                if (!result.deleted) {
                    newFolded.add(result.pos);
                }
            });

            if (action && action.type === 'TOGGLE') {
                const pos = action.pos;
                if (newFolded.has(pos)) {
                    newFolded.delete(pos);
                } else {
                    newFolded.add(pos);
                }
            }

            return { folded: newFolded };
        }
    },
    props: {
        decorations(state) {
            const { doc } = state;
            const { folded } = this.getState(state);
            const decorations: Decoration[] = [];

            // 1. Iterate document to find headings and calculate fold ranges
            doc.descendants((node, pos) => {
                if (node.type.name === 'heading') {
                    const isFolded = folded.has(pos);
                    const level = getHeadingLevel(node);

                    // A. Render Toggle Widget
                    const widget = Decoration.widget(pos + 1, (view) => {
                        const btn = document.createElement('div');
                        btn.className = `heading-collapse-btn ${isFolded ? 'collapsed' : ''}`;
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

                        btn.onclick = (e) => {
                            e.preventDefault();
                            const tr = view.state.tr.setMeta(collapsePluginKey, { type: 'TOGGLE', pos });
                            view.dispatch(tr);
                        };
                        return btn;
                    }, { side: -1 });
                    decorations.push(widget);

                    // B. If folded, hide content
                    if (isFolded) {
                        // Scan forward to find end of section
                        // We need to hide all sibling nodes until next heading with level <= current level
                        let currentPos = pos + node.nodeSize;

                        // Simple scan in a flat document model
                        // Note: descents iterates detailed nodes, but we want to skip over the content we are folding
                        // Actually, ProseMirror descendants iterator is depth-first.
                        // But headings are usually top-level blocks or inside blockquotes. 
                        // To efficiently hide siblings, we should look at the parent's children.

                        // However, inside `descendants` callback, `pos` is absolute. 
                        // It's safer to resolve the position to find siblings.
                        const $pos = doc.resolve(pos);
                        // $pos.index() is the index of this heading in its parent
                        // We iterate from index + 1

                        const parent = $pos.parent;
                        const index = $pos.index();

                        let endOfSection = false;

                        for (let i = index + 1; i < parent.childCount; i++) {
                            const sibling = parent.child(i);
                            // Check if sibling is a heading with level <= current
                            if (sibling.type.name === 'heading' && getHeadingLevel(sibling) <= level) {
                                endOfSection = true;
                                break;
                            }

                            // It is content to hide
                            // Determine absolute position of this sibling
                            // Wait, calculating absolute pos from child index loops can be expensive if not careful
                            // Better to use a cumulative pos approach if possible, but map is fast enough for localized work.

                            // We can get position by adding up sizes? No, `doc.resolve` gives us parent start.
                            // Actually, we can just use `pos + accumulation`.
                        }
                        // This logic inside `descendants` is O(N^2) if we re-scan simple lists.
                        // Better approach: Single pass loop over doc at block level.
                    }
                }
                // Continue iterating
                return false; // Don't descend into heading text content
            });

            // Re-implementing the loop to be linear and robust
            // We only care about block-level headings (usually top level or nested in structural nodes)
            // Let's just iterate the doc children if we assume a flat-ish structure (like Markdown usually is)
            // Milkdown/CommonMark structure: doc -> blocks (heading, paragraph, etc.)

            const strictDecorations: Decoration[] = [];
            doc.forEach((node, pos) => {
                if (node.type.name === 'heading') {
                    const isFolded = folded.has(pos);

                    // Widget
                    const widget = Decoration.widget(pos + 1, (view) => {
                        const btn = document.createElement('div');
                        btn.className = `heading-collapse-btn ${isFolded ? 'collapsed' : ''}`;
                        // Triangle icon
                        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="triangle"><path d="M9 18l6-6-6-6"/></svg>`;

                        btn.onclick = (e) => {
                            e.preventDefault();
                            // Tricky: 'pos' here is closure-bound to the render time iteration.
                            // But decorations are re-computed on state update, so 'pos' should remain valid-ish 
                            // relative to the doc version used to generate this.
                            // Actually, 'pos' is correct for the transaction dispatch.
                            const tr = view.state.tr.setMeta(collapsePluginKey, { type: 'TOGGLE', pos });
                            view.dispatch(tr);
                        };
                        return btn;
                    }, { side: -1, ignoreSelection: true });
                    strictDecorations.push(widget);
                }
            });

            // Hide Logic via Decoration.node
            // Need to know "active fold level" during iteration
            let activeFoldLevel = 999;
            let activeFoldStart = -1; // Not strictly needed if we just act on nodes

            // Iterate doc block-by-block
            doc.forEach((node, pos) => {
                if (node.type.name === 'heading') {
                    const level = getHeadingLevel(node);

                    // Check if this heading terminates the current fold
                    if (level <= activeFoldLevel) {
                        // Fold ends
                        activeFoldLevel = 999;
                    }

                    // Check if this heading starts a new fold
                    if (folded.has(pos)) {
                        // Only Fold if we are not already inside a stricter fold? 
                        // Affine logic: if H2 is inside folded H1, H2 is hidden anyway.
                        // So we only care if we are NOT currently hidden.
                        if (activeFoldLevel === 999) {
                            activeFoldLevel = level;
                        }
                    }
                } else {
                    // Not a heading (paragraph, etc.)
                    // If activeFoldLevel is set, hide this node
                    if (activeFoldLevel !== 999) {
                        const deco = Decoration.node(pos, pos + node.nodeSize, { class: 'hidden-node' });
                        strictDecorations.push(deco);
                    }
                }
            });

            return DecorationSet.create(doc, strictDecorations);
        }
    }
});
