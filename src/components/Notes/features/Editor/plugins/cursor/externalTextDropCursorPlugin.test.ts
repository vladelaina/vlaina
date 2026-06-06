import { describe, expect, it } from 'vitest';
import { CHAT_HEADING_DRAG_MIME } from '@/lib/drag/chatHeadingDrag';
import {
  MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN,
  hasExternalTextDrag,
  hasHeadingDropPayload,
} from './externalTextDropCursorPlugin';

function createTransfer(types: ArrayLike<string>, getData: (type: string) => string = () => ''): DataTransfer {
  return {
    getData,
    types,
  } as unknown as DataTransfer;
}

describe('externalTextDropCursorPlugin drag payload detection', () => {
  it('detects ordinary external text drag types', () => {
    expect(hasExternalTextDrag(createTransfer(['text/plain']))).toBe(true);
    expect(hasExternalTextDrag(createTransfer(['text/html']))).toBe(true);
    expect(hasExternalTextDrag(createTransfer(['text/uri-list']))).toBe(true);
  });

  it('does not treat file drags as external text drags', () => {
    expect(hasExternalTextDrag(createTransfer(['text/plain', 'Files']))).toBe(false);
  });

  it('does not scan drag type lists beyond the safety cap', () => {
    let accessed = 0;
    const types = {
      length: MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN + 1,
      item(index: number) {
        accessed += 1;
        if (index >= MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN) {
          throw new Error('Read past drag type scan cap');
        }
        return index === 0 ? 'text/plain' : 'application/octet-stream';
      },
    };

    expect(hasExternalTextDrag(createTransfer(types))).toBe(false);
    expect(accessed).toBe(MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN);
  });

  it('detects heading drops from the custom chat heading mime type', () => {
    expect(hasHeadingDropPayload(createTransfer([CHAT_HEADING_DRAG_MIME]))).toBe(true);
  });

  it('detects single heading drops from html payloads', () => {
    expect(hasHeadingDropPayload(createTransfer(['text/html'], (type) => (
      type === 'text/html' ? '<h2>Heading</h2>' : ''
    )))).toBe(true);
  });

  it('does not parse heading html after the drag type scan cap is exhausted', () => {
    const types = {
      length: MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN + 1,
      item(index: number) {
        if (index >= MAX_EXTERNAL_TEXT_DRAG_TYPE_SCAN) {
          throw new Error('Read past drag type scan cap');
        }
        return index === 0 ? 'text/html' : 'application/octet-stream';
      },
    };

    expect(hasHeadingDropPayload(createTransfer(types, () => {
      throw new Error('HTML should not be parsed for oversized drag type lists');
    }))).toBe(false);
  });
});
