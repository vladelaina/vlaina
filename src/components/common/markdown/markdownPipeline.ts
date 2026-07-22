import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkCitationParser from '@/lib/ai/plugins/remarkCitationParser';
import {
  createMarkdownSanitizeSchema,
  rehypeImageSrcSanitizer,
  rehypeImageSrcsetSanitizer,
  rehypeRawHtmlUrlSanitizer,
} from './imagePolicy';
import { rehypeNotesKatex } from './rehypeNotesKatex';
import { remarkParenthesizedMath } from './remarkParenthesizedMath';
import { remarkNotesInlineExtensions } from './remarkNotesExtensions';
import { rehypeDropUnsafeRawHtmlContent } from './rawHtmlSanitizer';

const MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();

export const READONLY_MARKDOWN_REMARK_PLUGINS = [
  remarkGfm,
  remarkMath,
  remarkParenthesizedMath,
  [remarkNotesInlineExtensions, { stripAbbrDefinitions: true }],
  remarkCitationParser,
].filter(Boolean) as any[];

export const READONLY_MARKDOWN_REHYPE_PLUGINS = [
  rehypeDropUnsafeRawHtmlContent,
  rehypeRaw,
  rehypeDropUnsafeRawHtmlContent,
  rehypeImageSrcSanitizer,
  [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA],
  rehypeRawHtmlUrlSanitizer,
  rehypeImageSrcsetSanitizer,
  rehypeNotesKatex,
] as any[];

export const CHAT_MARKDOWN_REMARK_PLUGINS = READONLY_MARKDOWN_REMARK_PLUGINS;
export const CHAT_MARKDOWN_REHYPE_PLUGINS = READONLY_MARKDOWN_REHYPE_PLUGINS;
