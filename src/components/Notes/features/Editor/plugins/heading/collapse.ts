import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';

export const collapsePluginKey = new PluginKey('collapse-heading');

function getHeadingLevel(node: Node): number {
    return node.attrs.level || 0;
}

export const collapsePlugin = $prose(() => new Plugin({
    key: collapsePluginKey,
    state: {
        init() {
            return { folded: new Set<number>() };
        },
        apply(tr, value) {
            const action = tr.getMeta(collapsePluginKey);
            const newFolded = new Set<number>();

            // Map existing positions
            value.folded.forEach((pos: number) => {
                const result = tr.mapping.mapResult(pos);
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pluginState = this.getState(state) as { folded: Set<number> } | undefined;

            if (!pluginState) return DecorationSet.empty;

            const { folded } = pluginState;
            const strictDecorations: Decoration[] = [];

            // Pass 1: Add Widgets to all headings
            doc.forEach((node, pos) => {
                if (node.type.name === 'heading') {

                    // Skip check for title (First H1) effectively removed
                    // Old code: if (level === 1 && !titleFound) { titleFound = true; return; }

                    const isFolded = folded.has(pos);

                    // Widget (Triangle Icon)
                    const widget = Decoration.widget(pos + 1, (view) => {
                        const btn = document.createElement('div');
                        btn.className = `heading-collapse-btn ${isFolded ? 'collapsed' : ''}`;
                        // Solid Triangle (Small)
                        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="8 5 19 12 8 19"></polygon></svg>`;

                        btn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const tr = view.state.tr.setMeta(collapsePluginKey, { type: 'TOGGLE', pos });
                            view.dispatch(tr);
                        };
                        btn.onmousedown = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        return btn;
                    }, { side: -1, ignoreSelection: true, stopEvent: () => true });
                    strictDecorations.push(widget);
                }
            });

            // Reset for Pass 2
            let activeFoldLevel = 999;

            // Pass 2: Calculate Visibility based on Folding
            doc.forEach((node, pos) => {
                let shouldHide = false;

                if (node.type.name === 'heading') {
                    const level = getHeadingLevel(node);

                    // 1. Check if this heading terminates the *current* active fold
                    // (Matches logic: Fold ends when we meet a sibling or parent level)
                    if (activeFoldLevel !== 999 && level <= activeFoldLevel) {
                        activeFoldLevel = 999;
                    }

                    // 2. If we are still in a fold, this heading itself should be hidden
                    if (activeFoldLevel !== 999) {
                        shouldHide = true;
                    }

                    // 3. If visible, check if this heading starts its own NEW fold
                    if (!shouldHide && folded.has(pos)) {
                        activeFoldLevel = level;
                    }
                } else {
                    // Non-heading node
                    if (activeFoldLevel !== 999) {
                        shouldHide = true;
                    }
                }

                if (shouldHide) {
                    const deco = Decoration.node(pos, pos + node.nodeSize, { class: 'hidden-node' });
                    strictDecorations.push(deco);
                }
            });

            return DecorationSet.create(doc, strictDecorations);
        }
    }
}));
