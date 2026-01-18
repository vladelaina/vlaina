import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

export const debugPluginKey = new PluginKey('debug-cursor');

export const debugPlugin = $prose(() => {
    return new Plugin({
        key: debugPluginKey,
        state: {
            init() { },
            apply(tr, _value, _oldState, newState) {
                if (!tr.selectionSet) return;

                const { from } = newState.selection;
                const $pos = newState.doc.resolve(from);

                console.group('🔍 Editor Debug: Cursor at ' + from);

                // 1. Check Node
                console.log('Node:', $pos.parent.type.name);

                // 2. Check Marks
                const marks = $pos.marks();
                if (marks.length > 0) {
                    console.log('Marks:', marks.map(m => m.type.name).join(', '));
                    marks.forEach(m => console.log('Mark Details:', m));
                } else {
                    console.log('Marks: None');
                }

                // 3. Check Parent Node Attributes (maybe it's a code block?)
                console.log('Parent Attributes:', $pos.parent.attrs);

                console.groupEnd();

                return;
            }
        }
    });
});
