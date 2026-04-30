import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkCitationParser from '@/lib/ai/plugins/remarkCitationParser';
import { createMarkdownSanitizeSchema } from './imagePolicy';

const MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();

export const CHAT_MARKDOWN_REMARK_PLUGINS = [
  remarkGfm,
  remarkMath,
  remarkCitationParser,
].filter(Boolean);

export const CHAT_MARKDOWN_REHYPE_PLUGINS = [
  rehypeRaw,
  [rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA],
  rehypeKatex,
] as any[];
