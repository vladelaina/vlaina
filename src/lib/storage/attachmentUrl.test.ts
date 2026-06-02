import { describe, expect, it } from 'vitest';
import {
  extractStoredAttachmentFilename,
  inferAttachmentMimeTypeFromFilename,
  isAppFileAttachmentUrl,
  isStoredAttachmentSrc,
} from './attachmentUrl';

describe('attachmentUrl', () => {
  it('extracts safe attachment filenames from supported stored image URLs', () => {
    expect(extractStoredAttachmentFilename('attachment://demo%20image.png')).toBe('demo image.png');
    expect(extractStoredAttachmentFilename('app-file://attachment/demo.png')).toBe('demo.png');
    expect(extractStoredAttachmentFilename('file:///app/attachments/demo.png')).toBe('demo.png');
    expect(extractStoredAttachmentFilename('demo.png')).toBe('demo.png');
  });

  it('rejects path traversal and nested attachment filenames', () => {
    expect(extractStoredAttachmentFilename('attachment://../demo.png')).toBeNull();
    expect(extractStoredAttachmentFilename('attachment://%2e%2e%2fdemo.png')).toBeNull();
    expect(extractStoredAttachmentFilename('attachment://demo%00.png')).toBeNull();
    expect(extractStoredAttachmentFilename('attachment://demo%E2%80%AEpng.exe')).toBeNull();
    expect(extractStoredAttachmentFilename('attachment://demo%EF%BF%BD.png')).toBeNull();
    expect(extractStoredAttachmentFilename('app-file://attachment/folder/demo.png')).toBeNull();
    expect(extractStoredAttachmentFilename('app-file://attachment/%2e%2e%2fdemo.png')).toBeNull();
    expect(extractStoredAttachmentFilename('')).toBeNull();
  });

  it('extracts stored attachment filenames without URL query or fragment suffixes', () => {
    expect(extractStoredAttachmentFilename('attachment://demo.png?cache=1')).toBe('demo.png');
    expect(extractStoredAttachmentFilename('attachment://demo.png#preview')).toBe('demo.png');
    expect(extractStoredAttachmentFilename('app-file://attachment/demo.png?cache=1')).toBe('demo.png');
    expect(extractStoredAttachmentFilename('app-file://attachment/demo.png#preview')).toBe('demo.png');
    expect(extractStoredAttachmentFilename('file:///app/attachments/demo.png?cache=1')).toBe('demo.png');
  });

  it('does not treat remote attachment-looking URLs as stored files', () => {
    expect(extractStoredAttachmentFilename('https://example.test/attachments/demo.png')).toBeNull();
    expect(extractStoredAttachmentFilename('http://example.test/attachments/demo.png')).toBeNull();
  });

  it('detects stored attachment sources and mime types', () => {
    expect(isStoredAttachmentSrc('attachment://demo.png')).toBe(true);
    expect(isStoredAttachmentSrc('app-file://attachment/demo.png')).toBe(true);
    expect(isStoredAttachmentSrc('data:image/png;base64,a')).toBe(false);
    expect(isAppFileAttachmentUrl(new URL('app-file://attachment/demo.png'))).toBe(true);
    expect(isAppFileAttachmentUrl(new URL('app-file://attachment/folder/demo.png'))).toBe(false);
    expect(isAppFileAttachmentUrl(new URL('app-file://attachment/%2e%2e%2fdemo.png'))).toBe(false);
    expect(isAppFileAttachmentUrl(new URL('app-file://other/demo.png'))).toBe(false);
    expect(inferAttachmentMimeTypeFromFilename('demo.webp')).toBe('image/webp');
  });
});
