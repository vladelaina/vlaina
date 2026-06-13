import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  document: vi.fn(function document(options: unknown) {
    return { options };
  }),
  paragraph: vi.fn(function paragraph(options: unknown) {
    return { options };
  }),
  textRun: vi.fn(function textRun(options: unknown) {
    return { options };
  }),
  toBlob: vi.fn(async () => ({
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  })),
}));

vi.mock('docx', () => ({
  Document: mocks.document,
  HeadingLevel: {
    TITLE: 'TITLE',
    HEADING_1: 'HEADING_1',
    HEADING_2: 'HEADING_2',
    HEADING_3: 'HEADING_3',
    HEADING_4: 'HEADING_4',
    HEADING_5: 'HEADING_5',
    HEADING_6: 'HEADING_6',
  },
  Packer: {
    toBlob: mocks.toBlob,
  },
  Paragraph: mocks.paragraph,
  TextRun: mocks.textRun,
}));

import {
  createDocxExportBytes,
  MAX_DOCX_EXPORT_PARAGRAPHS,
} from './noteExportDocx';

describe('createDocxExportBytes', () => {
  beforeEach(() => {
    mocks.document.mockClear();
    mocks.paragraph.mockClear();
    mocks.textRun.mockClear();
    mocks.toBlob.mockClear();
    mocks.toBlob.mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
  });

  it('caps paragraph creation for newline-heavy markdown', async () => {
    const markdown = Array.from(
      { length: MAX_DOCX_EXPORT_PARAGRAPHS + 64 },
      (_value, index) => `line ${index}`,
    ).join('\n');

    await expect(createDocxExportBytes(markdown, 'Title')).resolves.toEqual(new Uint8Array([1, 2, 3]));

    const documentOptions = mocks.document.mock.calls[0]?.[0] as {
      sections: Array<{ children: unknown[] }>;
    };
    const children = documentOptions.sections[0]?.children ?? [];
    expect(children).toHaveLength(MAX_DOCX_EXPORT_PARAGRAPHS);
    expect(mocks.paragraph.mock.calls.length).toBeLessThanOrEqual(MAX_DOCX_EXPORT_PARAGRAPHS + 2);
    expect(mocks.textRun.mock.calls.at(-1)?.[0]).toBe('[Document truncated for export safety]');
  });

  it('caps buffered code block lines before the closing fence', async () => {
    const markdown = [
      '```',
      ...Array.from(
        { length: MAX_DOCX_EXPORT_PARAGRAPHS + 64 },
        (_value, index) => `code ${index}`,
      ),
    ].join('\n');

    await createDocxExportBytes(markdown, 'Title');

    const documentOptions = mocks.document.mock.calls[0]?.[0] as {
      sections: Array<{ children: unknown[] }>;
    };
    expect(documentOptions.sections[0]?.children).toHaveLength(MAX_DOCX_EXPORT_PARAGRAPHS);
    expect(mocks.paragraph.mock.calls.length).toBeLessThanOrEqual(MAX_DOCX_EXPORT_PARAGRAPHS + 1);
    expect(mocks.textRun.mock.calls.at(-1)?.[0]).toBe('[Document truncated for export safety]');
  });
});
