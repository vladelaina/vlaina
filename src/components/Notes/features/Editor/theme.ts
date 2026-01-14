/*
* Custom NekoTick Theme for Milkdown
* Replicates the visual style of modern block-based editors (1:1 visual match)
*/

import { rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';

// Class mappings for 1:1 visual replication
export const themeClasses = {
    root: 'prose mx-auto focus:outline-none min-h-[50vh] pb-32 pt-0',

    // Typography
    heading: {
        h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-6 mt-10 first:mt-0 text-[#121212] dark:text-[#eeeeee]',
        h2: 'scroll-m-20 pb-2 text-[2rem] font-semibold tracking-tight transition-colors first:mt-0 mb-4 mt-8 text-[#121212] dark:text-[#eeeeee]',
        h3: 'scroll-m-20 text-[1.75rem] font-semibold tracking-tight mb-3 mt-6 text-[#121212] dark:text-[#eeeeee]',
        h4: 'scroll-m-20 text-[1.5rem] font-semibold tracking-tight mb-2 mt-4 text-[#121212] dark:text-[#eeeeee]',
        h5: 'scroll-m-20 text-[1.25rem] font-semibold tracking-tight mb-2 mt-4 text-[#121212] dark:text-[#eeeeee]',
        h6: 'scroll-m-20 text-[1.125rem] font-semibold tracking-tight mb-2 mt-4 text-[#121212] dark:text-[#eeeeee]',
    },

    paragraph: 'leading-7 [&:not(:first-child)]:mt-6 text-[#121212] dark:text-[#eeeeee] text-[16px]',

    // Text Formatting
    strong: 'font-semibold text-[#121212] dark:text-[#eeeeee]',
    em: 'italic',
    code: 'relative rounded bg-[#f7f9fb] dark:bg-[#2c2c2c] px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium text-[#121212] dark:text-[#eeeeee] border border-[#e3e2e4] dark:border-[#333333]',
    link: 'font-medium text-[#1e96eb] underline underline-offset-4 cursor-pointer hover:text-[#0c7fd9] transition-colors',

    // Block Elements
    blockquote: 'mt-6 border-l-[3px] border-[#e0e0e0] dark:border-[#333333] pl-6 italic text-[#757575] dark:text-[#a0a0a0]',

    lists: {
        ul: 'my-6 ml-6 list-disc [&>li]:mt-2 marker:text-[#8e8e8e]',
        ol: 'my-6 ml-6 list-decimal [&>li]:mt-2 marker:text-[#8e8e8e]',
        li: 'pl-2',
        task: 'my-6 ml-0 list-none [&>li]:mt-2',
    },

    // Images & Media
    image: 'rounded-md border border-[#e3e2e4] dark:border-[#333333] bg-[#f4f5f7] dark:bg-[#2c2c2c]',

    // Table
    table: 'w-full caption-bottom text-sm my-6 overflow-y-auto',
    thead: '[&_tr]:border-b border-[#e3e2e4] dark:border-[#333333]',
    tbody: '[&_tr:last-child]:border-0',
    tr: 'border-b border-[#e3e2e4] dark:border-[#333333] transition-colors hover:bg-[#f4f5f7]/50 dark:hover:bg-[#2c2c2c]/50 data-[state=selected]:bg-[#f4f5f7] dark:data-[state=selected]:bg-[#2c2c2c]',
    th: 'h-10 px-4 text-left align-middle font-medium text-[#8e8e8e] dark:text-[#a0a0a0] bg-[#f4f5f7] dark:bg-[#2c2c2c]',
    td: 'p-4 align-middle [&:has([role=checkbox])]:pr-0',

    // Code Block
    fence: 'relative rounded-lg bg-[#f7f9fb] dark:bg-[#161616] border border-[#e3e2e4] dark:border-[#333333] my-6 font-mono text-sm',

    // Divider
    hr: 'my-8 border-[#e3e2e4] dark:border-[#333333]',
};

import { headingSchema, paragraphSchema, strongSchema, emphasisSchema, inlineCodeSchema, linkSchema, blockquoteSchema, hrSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import { listItemSchema, bulletListSchema, orderedListSchema } from '@milkdown/kit/preset/commonmark';
import { tableSchema, tableRowSchema, tableHeaderSchema, tableCellSchema } from '@milkdown/kit/preset/gfm';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';

// Plugin to apply theme classes
export function configureTheme(ctx: Ctx) {
    return async () => {
        // Apply root classes
        ctx.update(rootCtx, (root: unknown) => {
            if (root instanceof HTMLElement) {
                root.classList.add(...themeClasses.root.split(' '));
            }
            return root as (HTMLElement | null);
        });

        // Typography & Blocks
        ctx.update(paragraphSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['p', { class: themeClasses.paragraph }, 0]
        }));

        ctx.update(headingSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => {
                const level = node.attrs.level;
                const className = themeClasses.heading[`h${level}` as keyof typeof themeClasses.heading];
                return [`h${level}`, { class: className }, 0];
            }
        }));

        ctx.update(blockquoteSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['blockquote', { class: themeClasses.blockquote }, 0]
        }));

        ctx.update(hrSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['hr', { class: themeClasses.hr }]
        }));

        // Inline
        ctx.update(strongSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['strong', { class: themeClasses.strong }, 0]
        }));

        ctx.update(emphasisSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['em', { class: themeClasses.em }, 0]
        }));

        ctx.update(inlineCodeSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['code', { class: themeClasses.code }, 0]
        }));

        ctx.update(linkSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => ['a', { ...node.attrs, class: themeClasses.link }, 0]
        }));

        // Lists
        ctx.update(bulletListSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['ul', { class: themeClasses.lists.ul }, 0]
        }));

        ctx.update(orderedListSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['ol', { class: themeClasses.lists.ol }, 0]
        }));

        ctx.update(listItemSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['li', { class: themeClasses.lists.li }, 0]
        }));

        // Code Block
        ctx.update(codeBlockSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => ['div', { class: themeClasses.fence, 'data-language': node.attrs.language }, ['pre', ['code', { spellcheck: 'false' }, 0]]]
        }));

        // Images
        ctx.update(imageSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => ['img', { ...node.attrs, class: themeClasses.image }]
        }));

        // Table Nodes
        ctx.update(tableRowSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['tr', { class: themeClasses.tr }, 0]
        }));

        ctx.update(tableHeaderSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['th', { ..._node.attrs, class: themeClasses.th }, 0]
        }));

        ctx.update(tableCellSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['td', { ..._node.attrs, class: themeClasses.td }, 0]
        }));

        // Table Wrapper (already updated, keeping as is)
        ctx.update(tableSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['table', { class: themeClasses.table }, ['tbody', 0]]
        }));
    };
}
