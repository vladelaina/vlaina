import katexCss from 'katex/dist/katex.min.css?raw';
import { MARKDOWN_BODY_FONT_SIZE } from '@/components/common/markdown/markdownMetrics';
import {
  themeColorTokens,
  themeExportLayoutTokens,
  themeFontWeightTokens,
  themeRadiusTokens,
  themeTypographyTokens,
} from '@/styles/themeTokens';

export const EXPORT_WIDTH_PX = themeExportLayoutTokens.widthPx;

const EXPORT_CSS = `
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: ${themeColorTokens.exportText};
    background: ${themeColorTokens.exportSurface};
  }
  body {
    margin: ${themeExportLayoutTokens.pageMargin};
    background: ${themeColorTokens.exportSurface};
  }
  .note-export {
    box-sizing: border-box;
    width: ${EXPORT_WIDTH_PX}px;
    margin: ${themeExportLayoutTokens.documentMargin};
    padding: ${themeExportLayoutTokens.documentPadding};
    background: ${themeColorTokens.exportSurface};
  }
  .note-export h1.note-export-title {
    margin: ${themeExportLayoutTokens.titleMargin};
    font-size: ${themeTypographyTokens.exportTitleFontSize};
    line-height: ${themeTypographyTokens.exportTitleLineHeight};
    font-weight: ${themeFontWeightTokens.bold};
  }
  .note-export-body {
    font-size: ${MARKDOWN_BODY_FONT_SIZE}px;
    line-height: ${themeTypographyTokens.exportBodyLineHeight};
    overflow-wrap: anywhere;
  }
  .note-export-body h1,
  .note-export-body h2,
  .note-export-body h3,
  .note-export-body h4 {
    margin: ${themeExportLayoutTokens.headingMargin};
    line-height: ${themeTypographyTokens.exportHeadingLineHeight};
  }
  .note-export-body h1 { font-size: ${themeTypographyTokens.exportHeading1FontSize}; }
  .note-export-body h2 { font-size: ${themeTypographyTokens.exportHeading2FontSize}; }
  .note-export-body h3 { font-size: ${themeTypographyTokens.exportHeading3FontSize}; }
  .note-export-body p,
  .note-export-body ul,
  .note-export-body ol,
  .note-export-body blockquote,
  .note-export-body pre,
  .note-export-body table {
    margin: ${themeExportLayoutTokens.blockMargin};
  }
  .note-export-body blockquote {
    border-left: ${themeExportLayoutTokens.blockquoteBorderLeft} solid ${themeColorTokens.exportBorder};
    padding-left: ${themeExportLayoutTokens.blockquotePaddingLeft};
    color: ${themeColorTokens.exportMutedText};
  }
  .note-export-body code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: ${themeTypographyTokens.exportCodeFontSize};
    background: ${themeColorTokens.exportCodeSurface};
    border-radius: ${themeRadiusTokens.px4};
    padding: ${themeExportLayoutTokens.inlineCodePadding};
  }
  .note-export-body pre {
    overflow: auto;
    background: ${themeColorTokens.exportCodeSurface};
    border-radius: ${themeRadiusTokens.px6};
    padding: ${themeExportLayoutTokens.prePadding};
  }
  .note-export-body pre code {
    background: transparent;
    padding: ${themeExportLayoutTokens.preCodePadding};
  }
  .note-export-body img {
    max-width: ${themeExportLayoutTokens.mediaMaxWidth};
    height: ${themeExportLayoutTokens.mediaHeight};
    border-radius: ${themeRadiusTokens.px6};
  }
  .note-export-body [data-text-align='center'] {
    text-align: center;
  }
  .note-export-body [data-text-align='right'] {
    text-align: right;
  }
  .note-export-body table {
    width: ${themeExportLayoutTokens.tableWidth};
    border-collapse: collapse;
  }
  .note-export-body th,
  .note-export-body td {
    border: ${themeExportLayoutTokens.tableBorderWidth} solid ${themeColorTokens.exportBorder};
    padding: ${themeExportLayoutTokens.tableCellPadding};
    vertical-align: top;
  }
  .note-export-body th {
    background: ${themeColorTokens.exportCodeSurface};
    font-weight: ${themeFontWeightTokens.semibold};
  }
  @page {
    margin: ${themeExportLayoutTokens.pageMargin};
  }
`;

const FALLBACK_KATEX_EXPORT_CSS = `
  .katex {
    font: normal 1.21em KaTeX_Main, "Times New Roman", serif;
    line-height: 1.2;
    text-indent: 0;
    text-rendering: auto;
  }
  .katex .katex-mathml {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    padding: 0;
    border: 0;
    height: 1px;
    width: 1px;
    overflow: hidden;
  }
  .katex-html,
  .katex .base,
  .katex .strut,
  .katex .mspace {
    display: inline-block;
  }
  .katex-display {
    display: block;
    margin: 1em 0;
    text-align: center;
  }
  .katex-display > .katex {
    display: block;
  }
`;

const EXPORT_KATEX_CSS = katexCss.includes('.katex') ? katexCss : FALLBACK_KATEX_EXPORT_CSS;

export const EXPORT_DOCUMENT_CSS = `${EXPORT_KATEX_CSS}\n${EXPORT_CSS}`;
