import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/contrib/mhchem';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkCitationParser from '@/lib/ai/plugins/remarkCitationParser';
import { createMarkdownSanitizeSchema } from './imagePolicy';
import { remarkNotesInlineExtensions } from './remarkNotesExtensions';

const MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();

export const READONLY_MARKDOWN_REMARK_PLUGINS = [
  remarkGfm,
  remarkMath,
  remarkNotesInlineExtensions,
  remarkCitationParser,
].filter(Boolean);

export const READONLY_MARKDOWN_REHYPE_PLUGINS = [
  rehypeRaw,
  [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA],
  rehypeKatex,
] as any[];

export const CHAT_MARKDOWN_REMARK_PLUGINS = READONLY_MARKDOWN_REMARK_PLUGINS;
export const CHAT_MARKDOWN_REHYPE_PLUGINS = READONLY_MARKDOWN_REHYPE_PLUGINS;
