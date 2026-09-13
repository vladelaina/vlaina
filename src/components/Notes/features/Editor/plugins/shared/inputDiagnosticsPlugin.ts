import { Plugin, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { logDiagnostic } from '@/lib/diagnostics/diagnosticsLog';

function summarizeState(state: EditorState) {
  const { selection } = state;
  return {
    docSize: state.doc.content.size,
    blockCount: state.doc.childCount,
    selection: {
      type: selection.constructor.name,
      from: selection.from,
      to: selection.to,
      parent: selection.$from.parent.type.name,
      parentSize: selection.$from.parent.content.size,
      offset: selection.$from.parentOffset,
      level: selection.$from.parent.attrs.level,
    },
  };
}

function summarizeDOM(view: EditorView) {
  const selection = view.dom.ownerDocument.getSelection();
  const describeNode = (node: Node | null | undefined) => node ? {
    name: node.nodeName,
    parent: node.parentElement?.tagName,
    length: node.nodeType === 3 ? node.nodeValue?.length : node.childNodes.length,
    inEditor: view.dom.contains(node),
  } : null;
  return {
    composing: view.composing,
    anchor: describeNode(selection?.anchorNode),
    anchorOffset: selection?.anchorOffset,
    focus: describeNode(selection?.focusNode),
    focusOffset: selection?.focusOffset,
    activeElement: view.dom.ownerDocument.activeElement?.tagName,
  };
}

export function createInputDiagnosticsPlugin(): Plugin {
  let captureUntil = 0;
  let eventId = 0;
  return new Plugin({
    state: {
      init: () => null,
      apply(tr, value, oldState, newState) {
        if (Date.now() <= captureUntil && (tr.docChanged || tr.selectionSet)) {
          logDiagnostic('notes-input', 'transaction', () => ({
            eventId,
            before: summarizeState(oldState),
            after: summarizeState(newState),
            docChanged: tr.docChanged,
            selectionSet: tr.selectionSet,
            composition: tr.getMeta('composition'),
            uiEvent: tr.getMeta('uiEvent'),
            addToHistory: tr.getMeta('addToHistory'),
            appended: Boolean(tr.getMeta('appendedTransaction')),
            steps: tr.steps.map((step) => ({
              type: step.constructor.name,
              map: step.getMap().toString(),
            })),
            source: tr.docChanged ? new Error().stack?.split('\n').slice(1, 13).join('\n') : undefined,
          }));
        }
        return value;
      },
    },
    view(view) {
      let destroyed = false;
      const events = ['compositionstart', 'compositionupdate', 'compositionend',
        'keydown', 'beforeinput', 'input', 'focus', 'blur'];
      const handleEvent = (event: Event) => {
        const keyboard = event as KeyboardEvent;
        if (event.type.startsWith('composition') ||
          (event.type === 'keydown' && ['Backspace', 'Delete', 'Enter'].includes(keyboard.key))) {
          captureUntil = Date.now() + 5000;
        }
        if (Date.now() > captureUntil) return;
        const id = ++eventId;
        const input = event as InputEvent;
        logDiagnostic('notes-input', event.type, () => ({
          eventId: id,
          key: event.type === 'keydown'
            ? (keyboard.key.length === 1 ? 'character' : keyboard.key) : undefined,
          keyCode: event.type === 'keydown' && keyboard.keyCode === 229 ? 229 : undefined,
          isComposing: input.isComposing,
          inputType: input.inputType,
          dataLength: input.data?.length,
          defaultPrevented: event.defaultPrevented,
          state: summarizeState(view.state),
          dom: summarizeDOM(view),
        }));
        queueMicrotask(() => {
          if (destroyed) return;
          logDiagnostic('notes-input', `${event.type}:after`, () => ({
            eventId: id,
            defaultPrevented: event.defaultPrevented,
            state: summarizeState(view.state),
            dom: summarizeDOM(view),
          }));
        });
      };
      events.forEach((name) => view.dom.addEventListener(name, handleEvent, true));
      return {
        destroy() {
          destroyed = true;
          events.forEach((name) => view.dom.removeEventListener(name, handleEvent, true));
        },
      };
    },
  });
}

export const inputDiagnosticsPlugin = $prose(createInputDiagnosticsPlugin);
