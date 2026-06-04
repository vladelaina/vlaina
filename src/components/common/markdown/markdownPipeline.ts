import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/contrib/mhchem';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkCitationParser from '@/lib/ai/plugins/remarkCitationParser';
import { createMarkdownSanitizeSchema, rehypeImageSrcSanitizer, rehypeImageSrcsetSanitizer } from './imagePolicy';
import { KATEX_SHARED_RENDER_OPTIONS } from './katexOptions';
import { rehypeKatexSourceSanitizer } from './katexSourceSanitizer';
import { remarkNotesInlineExtensions } from './remarkNotesExtensions';

const MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();

export const READONLY_MARKDOWN_REMARK_PLUGINS = [
  remarkGfm,
  remarkMath,
  [remarkNotesInlineExtensions, { stripAbbrDefinitions: true }],
  remarkCitationParser,
].filter(Boolean);

export const READONLY_MARKDOWN_REHYPE_PLUGINS = [
  rehypeRaw,
  rehypeImageSrcSanitizer,
  [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA],
  rehypeImageSrcsetSanitizer,
  [rehypeKatex, KATEX_SHARED_RENDER_OPTIONS],
  rehypeKatexSourceSanitizer,
] as any[];

export const CHAT_MARKDOWN_REMARK_PLUGINS = READONLY_MARKDOWN_REMARK_PLUGINS;
export const CHAT_MARKDOWN_REHYPE_PLUGINS = READONLY_MARKDOWN_REHYPE_PLUGINS;
