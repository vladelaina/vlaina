import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { stripMarkdownInline } from '@/components/common/markdown/plainText';
import { themeExportLayoutTokens } from '@/styles/themeTokens';

export const MAX_DOCX_EXPORT_PARAGRAPHS = 20_000;
const DOCX_EXPORT_TRUNCATION_NOTICE = '[Document truncated for export safety]';

function createParagraph(text: string, options: Record<string, unknown> = {}) {
  return new Paragraph({
    ...options,
    children: [new TextRun(stripMarkdownInline(text))],
  });
}

function createCodeParagraph(text: string) {
  return new Paragraph({
    spacing: { before: themeExportLayoutTokens.docxCodeBeforeSpacing, after: themeExportLayoutTokens.docxCodeAfterSpacing },
    children: [
      new TextRun({
        text,
        font: 'JetBrains Mono',
        size: themeExportLayoutTokens.docxCodeFontSizeHalfPoints,
      }),
    ],
  });
}

export async function createDocxExportBytes(markdown: string, title: string): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: themeExportLayoutTokens.docxTitleAfterSpacing },
    }),
  ];
  let truncated = false;

  const appendParagraph = (paragraph: Paragraph): boolean => {
    if (children.length >= MAX_DOCX_EXPORT_PARAGRAPHS) {
      truncated = true;
      return false;
    }
    children.push(paragraph);
    return true;
  };

  const appendTruncationNotice = () => {
    const notice = createParagraph(DOCX_EXPORT_TRUNCATION_NOTICE);
    if (children.length < MAX_DOCX_EXPORT_PARAGRAPHS) {
      children.push(notice);
      return;
    }
    children[children.length - 1] = notice;
  };

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const flushCode = () => {
    if (codeBuffer.length === 0) return;
    for (const codeLine of codeBuffer) {
      if (!appendParagraph(createCodeParagraph(codeLine))) {
        break;
      }
    }
    codeBuffer = [];
  };

  for (const rawLine of lines) {
    if (truncated) {
      break;
    }

    const line = rawLine.trimEnd();

    if (/^```/.test(line.trim())) {
      if (inCodeBlock) {
        flushCode();
        if (truncated) {
          break;
        }
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      if (children.length + codeBuffer.length >= MAX_DOCX_EXPORT_PARAGRAPHS) {
        flushCode();
        truncated = true;
        break;
      }
      codeBuffer.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      appendParagraph(new Paragraph({ text: '' }));
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading =
        level === 1 ? HeadingLevel.HEADING_1 :
        level === 2 ? HeadingLevel.HEADING_2 :
        level === 3 ? HeadingLevel.HEADING_3 :
        level === 4 ? HeadingLevel.HEADING_4 :
        level === 5 ? HeadingLevel.HEADING_5 :
        HeadingLevel.HEADING_6;
      appendParagraph(createParagraph(headingMatch[2], {
        heading,
        spacing: {
          before: themeExportLayoutTokens.docxHeadingBeforeSpacing,
          after: themeExportLayoutTokens.docxHeadingAfterSpacing,
        },
      }));
      continue;
    }

    const bulletMatch = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      appendParagraph(createParagraph(bulletMatch[1], { bullet: { level: 0 } }));
      continue;
    }

    const orderedMatch = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (orderedMatch) {
      appendParagraph(createParagraph(orderedMatch[1], { bullet: { level: 0 } }));
      continue;
    }

    const quoteMatch = /^\s*>\s?(.+)$/.exec(line);
    if (quoteMatch) {
      appendParagraph(createParagraph(quoteMatch[1], {
        indent: { left: themeExportLayoutTokens.docxQuoteIndentLeft },
        spacing: {
          before: themeExportLayoutTokens.docxQuoteBeforeSpacing,
          after: themeExportLayoutTokens.docxQuoteAfterSpacing,
        },
      }));
      continue;
    }

    appendParagraph(createParagraph(line));
  }

  if (inCodeBlock && !truncated) {
    flushCode();
  }
  if (truncated) {
    appendTruncationNotice();
  }

  const document = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });
  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
