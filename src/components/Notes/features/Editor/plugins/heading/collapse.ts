import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';

const COLLAPSE_PLUGIN_KEY = new PluginKey('headingCollapse');

// Store collapsed heading positions
const collapsedHeadings = new Set<number>();

/**
 * Create toggle button element
 */
function createToggleButton(pos: number, isCollapsed: boolean, hasContent: boolean): HTMLElement {
  const button = document.createElement('span');
  button.className = 'heading-toggle-btn';
  button.setAttribute('data-collapsed', String(isCollapsed));
  button.setAttribute('data-has-content', String(hasContent));
  button.setAttribute('contenteditable', 'false');
  
  // Triangle icon (solid triangle pointing down)
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 6l4 4 4-4z"/>
    </svg>
  `;
  
  button.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const wasCollapsed = collapsedHeadings.has(pos);
    if (wasCollapsed) {
      collapsedHeadings.delete(pos);
    } else {
      collapsedHeadings.add(pos);
    }
    
    // Update button state immediately for visual feedback
    button.setAttribute('data-collapsed', String(!wasCollapsed));
    
    // Trigger editor update
    const event = new CustomEvent('heading-collapse-toggle', { detail: { pos } });
    document.dispatchEvent(event);
  });
  
  return button;
}

/**
 * Collect all nodes info from document
 */
function collectNodes(doc: ProseMirrorNode): Array<{ pos: number; node: ProseMirrorNode; endPos: number }> {
  const nodes: Array<{ pos: number; node: ProseMirrorNode; endPos: number }> = [];
  
  doc.forEach((node, offset) => {
    nodes.push({
      pos: offset,
      node,
      endPos: offset + node.nodeSize,
    });
  });
  
  return nodes;
}

/**
 * Find content range to collapse for a heading
 */
function getCollapsedNodePositions(
  nodes: Array<{ pos: number; node: ProseMirrorNode; endPos: number }>,
  headingIndex: number
): Array<{ from: number; to: number }> {
  const headingNode = nodes[headingIndex];
  const headingLevel = headingNode.node.attrs.level || 1;
  const result: Array<{ from: number; to: number }> = [];
  
  for (let i = headingIndex + 1; i < nodes.length; i++) {
    const currentNode = nodes[i];
    
    if (currentNode.node.type.name === 'heading') {
      const currentLevel = currentNode.node.attrs.level || 1;
      if (currentLevel <= headingLevel) {
        break;
      }
    }
    
    result.push({
      from: currentNode.pos,
      to: currentNode.endPos,
    });
  }
  
  return result;
}

/**
 * Heading Collapse Plugin
 */
export const collapsePlugin = $prose(() => {
  return new Plugin({
    key: COLLAPSE_PLUGIN_KEY,
    
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldState, _oldEditorState, newEditorState) {
        if (tr.docChanged || tr.getMeta(COLLAPSE_PLUGIN_KEY)) {
          const decorations: Decoration[] = [];
          const nodes = collectNodes(newEditorState.doc);
          
          nodes.forEach((nodeInfo, index) => {
            if (nodeInfo.node.type.name === 'heading') {
              const pos = nodeInfo.pos;
              const isCollapsed = collapsedHeadings.has(pos);
              const collapsedRanges = getCollapsedNodePositions(nodes, index);
              const hasContent = collapsedRanges.length > 0;
              
              const button = createToggleButton(pos, isCollapsed, hasContent);
              decorations.push(
                Decoration.widget(pos + 1, button, {
                  side: -1,
                  key: `toggle-${pos}`,
                })
              );
              
              if (isCollapsed && hasContent) {
                collapsedRanges.forEach(range => {
                  decorations.push(
                    Decoration.node(range.from, range.to, {
                      class: 'heading-collapsed-content',
                    })
                  );
                });
              }
            }
          });
          
          return DecorationSet.create(newEditorState.doc, decorations);
        }
        
        return oldState.map(tr.mapping, tr.doc);
      },
    },
    
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
    
    view(editorView) {
      const handleToggle = () => {
        const tr = editorView.state.tr.setMeta(COLLAPSE_PLUGIN_KEY, true);
        editorView.dispatch(tr);
      };
      
      document.addEventListener('heading-collapse-toggle', handleToggle);
      
      return {
        destroy() {
          document.removeEventListener('heading-collapse-toggle', handleToggle);
        },
      };
    },
  });
});
