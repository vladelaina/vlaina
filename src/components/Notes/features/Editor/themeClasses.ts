export const themeClasses = {
    root: 'prose mx-auto focus:outline-none min-h-[50vh] pb-32 pt-0',

    heading: {
        h1: 'text-[var(--vlaina-text-primary)]',
        h2: 'text-[var(--vlaina-text-primary)]',
        h3: 'text-[var(--vlaina-text-primary)]',
        h4: 'text-[var(--vlaina-text-primary)]',
        h5: 'text-[var(--vlaina-text-primary)]',
        h6: 'text-[var(--vlaina-text-primary)]',
    },

    paragraph: 'text-[var(--vlaina-text-primary)]',

    strong: 'font-semibold text-[var(--vlaina-text-primary)]',
    em: 'italic',
    code: 'inline-block align-baseline rounded bg-neutral-100 px-1 py-0.5 font-mono text-sm font-medium text-neutral-800 caret-[var(--vlaina-caret-color)] dark:bg-neutral-800 dark:text-neutral-100',
    link: 'font-medium text-[#1e96eb] underline underline-offset-4 cursor-pointer hover:text-[#0c7fd9] transition-colors',

    blockquote: 'mt-[26px] pl-[26px] text-[var(--vlaina-text-secondary)]',

    lists: {
        ul: 'my-[26px] ml-[26px] list-disc [&>li]:mt-2 marker:text-[var(--vlaina-text-secondary)]',
        ol: 'my-[26px] ml-[26px] list-decimal [&>li]:mt-2 marker:text-[var(--vlaina-text-secondary)]',
        li: 'pl-2',
        task: 'my-[26px] ml-0 list-none [&>li]:mt-2',
    },

    image: 'rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-bg-tertiary)]',

    table: 'w-max max-w-full caption-bottom text-sm my-0 overflow-y-auto',
    thead: '[&_tr]:border-b border-[var(--vlaina-border)]',
    tbody: '[&_tr:last-child]:border-0',
    tr: 'border-b border-[var(--vlaina-border)] transition-colors hover:bg-[var(--vlaina-bg-hover)] data-[state=selected]:bg-[var(--vlaina-bg-tertiary)]',
    th: 'h-[42px] px-4 text-left align-middle font-medium text-[var(--vlaina-text-secondary)] bg-[var(--vlaina-bg-tertiary)]',
    td: 'p-4 align-middle [&:has([role=checkbox])]:pr-0',

    fence: 'relative rounded-lg bg-[var(--vlaina-bg-secondary)] border border-[var(--vlaina-border)] my-[26px] font-mono text-[13px]',

    hr: 'my-0 border-0 h-0',
};
