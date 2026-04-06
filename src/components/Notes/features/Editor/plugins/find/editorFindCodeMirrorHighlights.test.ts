import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView as CodeMirror } from '@codemirror/view';
import type { EditorFindMatch } from './editorFindMatches';
import {
  buildCodeMirrorFindHighlightRanges,
  codeMirrorFindHighlightExtensions,
  syncCodeMirrorFindHighlights,
} from './editorFindCodeMirrorHighlights';
import { mapDocumentOffsetToCodeBlockEditorOffset } from '../code/codemirror';

function createMatch(from: number, to: number): EditorFindMatch {
  return {
    from,
    to,
    ranges: [{ from, to }],
  };
}

describe('editorFindCodeMirrorHighlights', () => {
  it('maps document ranges into CodeMirror ranges for CRLF-backed content', () => {
    expect(
      buildCodeMirrorFindHighlightRanges({
        matches: [
          createMatch(103, 107),
          createMatch(109, 110),
          createMatch(112, 116),
        ],
        activeIndex: 1,
        contentFrom: 100,
        contentTo: 110,
        rawText: 'a\r\nbeta\r\ng',
        mapDocumentOffsetToEditorOffset: mapDocumentOffsetToCodeBlockEditorOffset,
      }),
    ).toEqual([
      {
        from: 2,
        to: 6,
        active: false,
      },
      {
        from: 7,
        to: 8,
        active: true,
      },
    ]);
  });

  it('applies inactive and active highlight classes inside CodeMirror', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const cm = new CodeMirror({
      parent: host,
      state: EditorState.create({
        doc: 'hello world',
        extensions: [...codeMirrorFindHighlightExtensions],
      }),
    });

    syncCodeMirrorFindHighlights(cm, [
      { from: 0, to: 5, active: false },
      { from: 6, to: 11, active: true },
    ]);

    expect(cm.dom.querySelectorAll('.vlaina-editor-find-match')).toHaveLength(2);
    expect(cm.dom.querySelectorAll('.vlaina-editor-find-match-active')).toHaveLength(1);

    cm.destroy();
    host.remove();
  });
});
