export type AiReviewVariantLayout =
  | 'parallel'
  | 'spotlight'
  | 'compact';

export type AiReviewVariant = {
  id: string;
  name: string;
  description: string;
  layout: AiReviewVariantLayout;
  surfaceClassName: string;
  panelClassName: string;
  badgeClassName: string;
  titleClassName: string;
  metaClassName: string;
  bodyClassName: string;
  beforeCardClassName: string;
  afterCardClassName: string;
  labelClassName: string;
  beforeTextClassName: string;
  afterTextClassName: string;
  footerClassName: string;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  tertiaryButtonClassName: string;
  accentClassName: string;
  fontClassName?: string;
};

const LINEN_THEME = {
  surfaceClassName: 'border border-stone-200 bg-[linear-gradient(180deg,#fffefb,#fbf7f0)]',
  panelClassName: 'border border-stone-200 bg-white shadow-[0_22px_42px_-32px_rgba(120,113,108,0.16)]',
  badgeClassName: 'bg-stone-100 text-stone-600',
  titleClassName: 'text-stone-950',
  metaClassName: 'text-stone-500',
  beforeCardClassName: 'border border-stone-200 bg-[#fcfaf5]',
  afterCardClassName: 'border border-amber-100 bg-[#fffbef]',
  labelClassName: 'text-stone-500',
  beforeTextClassName: 'text-stone-700',
  afterTextClassName: 'text-stone-800',
  footerClassName: 'border-t border-stone-100',
  primaryButtonClassName: 'bg-stone-950 text-white hover:bg-stone-900',
  secondaryButtonClassName: 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
  tertiaryButtonClassName: 'border border-transparent bg-stone-100/80 text-stone-600 hover:bg-stone-100',
  accentClassName: 'from-amber-200/70 via-white to-orange-100/70',
  fontClassName: 'font-serif',
} as const;

export const AI_REVIEW_ACTION = 'Translate to English';

export const AI_REVIEW_BEFORE_TEXT =
  'The release notes still feel uneven, and the key changes are easy to miss on a fast read.';

export const AI_REVIEW_AFTER_TEXT =
  'The release notes still feel uneven, and the key updates are easy to miss when someone scans quickly.';

export const AI_REVIEW_VARIANTS: AiReviewVariant[] = [
  {
    id: 'linen-parallel',
    name: 'Linen Parallel',
    description: 'Balanced two-column compare with equal weight on before and after. Warm paper tone for writing-heavy workflows and editorial calm.',
    layout: 'parallel',
    bodyClassName: 'grid gap-3 sm:grid-cols-2',
    ...LINEN_THEME,
  },
  {
    id: 'linen-spotlight',
    name: 'Linen Spotlight',
    description: 'Pushes the rewritten result forward and keeps the original quietly above it. Warm paper tone for writing-heavy workflows and editorial calm.',
    layout: 'spotlight',
    bodyClassName: 'grid gap-3',
    ...LINEN_THEME,
  },
  {
    id: 'linen-compact',
    name: 'Linen Compact',
    description: 'Dense and efficient for frequent low-friction confirmations. Warm paper tone for writing-heavy workflows and editorial calm.',
    layout: 'compact',
    bodyClassName: 'grid gap-2',
    ...LINEN_THEME,
  },
];
