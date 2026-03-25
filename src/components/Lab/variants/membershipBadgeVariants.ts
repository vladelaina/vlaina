export type MembershipBadgeTone = 'free' | 'plus' | 'pro' | 'max';

export interface MembershipBadgeVariantToneStyle {
  haloClassName: string;
  backClassName: string;
  orbitClassName: string;
  dotClassName: string;
  coreClassName: string;
  crownClassName: string;
  crownStrokeWidth: number;
}

export interface MembershipBadgeVariant {
  id: string;
  name: string;
  category: string;
  description: string;
  stageClassName: string;
  shellClassName: string;
  eyebrowClassName: string;
  rowClassName: string;
  identityClassName: string;
  metaClassName: string;
  avatarClassName: string;
  badgeWrapClassName: string;
  haloBaseClassName: string;
  backBaseClassName: string;
  orbitBaseClassName: string;
  dotBaseClassName: string;
  coreBaseClassName: string;
  tierStyles: Record<MembershipBadgeTone, MembershipBadgeVariantToneStyle>;
}

const neutralTone: MembershipBadgeVariantToneStyle = {
  haloClassName: '',
  backClassName: '',
  orbitClassName: '',
  dotClassName: '',
  coreClassName: 'border-zinc-200 bg-white',
  crownClassName: 'text-zinc-500',
  crownStrokeWidth: 2.1,
};

export const membershipBadgeVariants: MembershipBadgeVariant[] = [
  {
    id: 'porcelain-crest',
    name: 'Porcelain Crest',
    category: 'refined',
    description: 'Clean white coin with a sharper crown and very light luxury framing.',
    stageClassName: 'bg-[radial-gradient(circle_at_top,#ffffff,#eef4ff_46%,#f8fafc_92%)]',
    shellClassName: 'rounded-[30px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_28px_60px_rgba(148,163,184,0.16)] backdrop-blur',
    eyebrowClassName: 'bg-slate-100 text-slate-700',
    rowClassName: 'rounded-[22px] border border-slate-200/70 bg-white px-4 py-3.5',
    identityClassName: 'text-slate-950',
    metaClassName: 'text-slate-500',
    avatarClassName: 'border-white/90 bg-[linear-gradient(135deg,#e2e8f0,#f8fafc)] shadow-[0_16px_32px_rgba(148,163,184,0.20)]',
    badgeWrapClassName: 'absolute -bottom-2 -right-2 h-9 w-9',
    haloBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    backBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    orbitBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    dotBaseClassName: 'absolute opacity-0',
    coreBaseClassName: 'relative flex h-full w-full items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(15,23,42,0.12)]',
    tierStyles: {
      free: neutralTone,
      plus: {
        haloClassName: '',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-sky-200 bg-white',
        crownClassName: 'text-sky-500',
        crownStrokeWidth: 2.2,
      },
      pro: {
        haloClassName: '',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-violet-200 bg-white',
        crownClassName: 'text-violet-500',
        crownStrokeWidth: 2.2,
      },
      max: {
        haloClassName: '',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-amber-200 bg-white',
        crownClassName: 'text-amber-500',
        crownStrokeWidth: 2.2,
      },
    },
  },
  {
    id: 'halo-ring',
    name: 'Halo Ring',
    category: 'luminous',
    description: 'A colored halo around the white crown coin, more visible from a distance.',
    stageClassName: 'bg-[radial-gradient(circle_at_top,#ffffff,#ecfeff_38%,#eef2ff_78%)]',
    shellClassName: 'rounded-[30px] border border-cyan-100/80 bg-white/86 p-6 shadow-[0_28px_62px_rgba(103,232,249,0.18)] backdrop-blur',
    eyebrowClassName: 'bg-cyan-50 text-cyan-700',
    rowClassName: 'rounded-[22px] border border-cyan-100/70 bg-white px-4 py-3.5',
    identityClassName: 'text-slate-950',
    metaClassName: 'text-slate-500',
    avatarClassName: 'border-white/90 bg-[linear-gradient(135deg,#cffafe,#e0f2fe)] shadow-[0_16px_32px_rgba(34,211,238,0.18)]',
    badgeWrapClassName: 'absolute -bottom-2 -right-2 h-9 w-9',
    haloBaseClassName: 'absolute inset-[-3px] rounded-full blur-[1px]',
    backBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    orbitBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    dotBaseClassName: 'absolute opacity-0',
    coreBaseClassName: 'relative flex h-full w-full items-center justify-center rounded-full border bg-white shadow-[0_10px_24px_rgba(15,23,42,0.10)]',
    tierStyles: {
      free: {
        ...neutralTone,
        haloClassName: 'bg-zinc-200/90',
      },
      plus: {
        haloClassName: 'bg-sky-300/90',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-sky-100 bg-white',
        crownClassName: 'text-sky-500',
        crownStrokeWidth: 2.25,
      },
      pro: {
        haloClassName: 'bg-fuchsia-300/90',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-fuchsia-100 bg-white',
        crownClassName: 'text-fuchsia-500',
        crownStrokeWidth: 2.25,
      },
      max: {
        haloClassName: 'bg-amber-300/95',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-amber-100 bg-white',
        crownClassName: 'text-amber-500',
        crownStrokeWidth: 2.25,
      },
    },
  },
  {
    id: 'offset-medal',
    name: 'Offset Medal',
    category: 'graphic',
    description: 'White crown coin with a colored medal layer peeking from behind.',
    stageClassName: 'bg-[radial-gradient(circle_at_top,#ffffff,#f5f3ff_38%,#eff6ff_84%)]',
    shellClassName: 'rounded-[30px] border border-indigo-100/80 bg-white/88 p-6 shadow-[0_28px_62px_rgba(129,140,248,0.16)] backdrop-blur',
    eyebrowClassName: 'bg-indigo-50 text-indigo-700',
    rowClassName: 'rounded-[22px] border border-indigo-100/70 bg-white px-4 py-3.5',
    identityClassName: 'text-slate-950',
    metaClassName: 'text-slate-500',
    avatarClassName: 'border-white/90 bg-[linear-gradient(135deg,#ddd6fe,#dbeafe)] shadow-[0_16px_32px_rgba(129,140,248,0.18)]',
    badgeWrapClassName: 'absolute -bottom-2 -right-2 h-9 w-9',
    haloBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    backBaseClassName: 'absolute inset-[2px] rounded-full translate-x-[3px] translate-y-[3px]',
    orbitBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    dotBaseClassName: 'absolute opacity-0',
    coreBaseClassName: 'relative flex h-full w-full items-center justify-center rounded-full border bg-white shadow-[0_12px_22px_rgba(15,23,42,0.12)]',
    tierStyles: {
      free: {
        ...neutralTone,
        backClassName: 'bg-zinc-200',
      },
      plus: {
        haloClassName: '',
        backClassName: 'bg-cyan-300',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-cyan-100 bg-white',
        crownClassName: 'text-cyan-500',
        crownStrokeWidth: 2.2,
      },
      pro: {
        haloClassName: '',
        backClassName: 'bg-violet-300',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-violet-100 bg-white',
        crownClassName: 'text-violet-500',
        crownStrokeWidth: 2.2,
      },
      max: {
        haloClassName: '',
        backClassName: 'bg-rose-300',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-rose-100 bg-white',
        crownClassName: 'text-rose-500',
        crownStrokeWidth: 2.2,
      },
    },
  },
  {
    id: 'orbit-mark',
    name: 'Orbit Mark',
    category: 'distinct',
    description: 'A thin orbital ring and marker dot make the white coin feel more iconic.',
    stageClassName: 'bg-[radial-gradient(circle_at_top,#ffffff,#ecfccb_30%,#eff6ff_82%)]',
    shellClassName: 'rounded-[30px] border border-lime-100/70 bg-white/88 p-6 shadow-[0_28px_62px_rgba(163,230,53,0.14)] backdrop-blur',
    eyebrowClassName: 'bg-lime-50 text-lime-800',
    rowClassName: 'rounded-[22px] border border-lime-100/70 bg-white px-4 py-3.5',
    identityClassName: 'text-slate-950',
    metaClassName: 'text-slate-500',
    avatarClassName: 'border-white/90 bg-[linear-gradient(135deg,#ecfccb,#dbeafe)] shadow-[0_16px_32px_rgba(132,204,22,0.16)]',
    badgeWrapClassName: 'absolute -bottom-2.5 -right-2.5 h-10 w-10',
    haloBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    backBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    orbitBaseClassName: 'absolute inset-[-3px] rounded-full border',
    dotBaseClassName: 'absolute right-[-1px] top-[4px] h-2.5 w-2.5 rounded-full border-2 border-white',
    coreBaseClassName: 'relative z-[1] flex h-full w-full items-center justify-center rounded-full border bg-white shadow-[0_12px_22px_rgba(15,23,42,0.10)]',
    tierStyles: {
      free: {
        ...neutralTone,
        orbitClassName: 'border-zinc-300/90',
        dotClassName: 'bg-zinc-400',
      },
      plus: {
        haloClassName: '',
        backClassName: '',
        orbitClassName: 'border-sky-300/90',
        dotClassName: 'bg-sky-400',
        coreClassName: 'border-sky-100 bg-white',
        crownClassName: 'text-sky-500',
        crownStrokeWidth: 2.2,
      },
      pro: {
        haloClassName: '',
        backClassName: '',
        orbitClassName: 'border-emerald-300/90',
        dotClassName: 'bg-emerald-400',
        coreClassName: 'border-emerald-100 bg-white',
        crownClassName: 'text-emerald-500',
        crownStrokeWidth: 2.2,
      },
      max: {
        haloClassName: '',
        backClassName: '',
        orbitClassName: 'border-amber-300/90',
        dotClassName: 'bg-amber-400',
        coreClassName: 'border-amber-100 bg-white',
        crownClassName: 'text-amber-500',
        crownStrokeWidth: 2.2,
      },
    },
  },
  {
    id: 'jewel-flare',
    name: 'Jewel Flare',
    category: 'premium',
    description: 'Soft color bloom behind the white coin for a more premium and memorable mark.',
    stageClassName: 'bg-[radial-gradient(circle_at_top,#ffffff,#fdf2f8_30%,#eef2ff_76%)]',
    shellClassName: 'rounded-[30px] border border-pink-100/70 bg-white/88 p-6 shadow-[0_28px_62px_rgba(244,114,182,0.14)] backdrop-blur',
    eyebrowClassName: 'bg-pink-50 text-pink-700',
    rowClassName: 'rounded-[22px] border border-pink-100/70 bg-white px-4 py-3.5',
    identityClassName: 'text-slate-950',
    metaClassName: 'text-slate-500',
    avatarClassName: 'border-white/90 bg-[linear-gradient(135deg,#fce7f3,#e0e7ff)] shadow-[0_16px_32px_rgba(244,114,182,0.18)]',
    badgeWrapClassName: 'absolute -bottom-2 -right-2 h-9 w-9',
    haloBaseClassName: 'absolute inset-[-4px] rounded-full blur-md',
    backBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    orbitBaseClassName: 'absolute inset-0 rounded-full opacity-0',
    dotBaseClassName: 'absolute opacity-0',
    coreBaseClassName: 'relative flex h-full w-full items-center justify-center rounded-full border bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]',
    tierStyles: {
      free: {
        ...neutralTone,
        haloClassName: 'bg-zinc-200/50',
      },
      plus: {
        haloClassName: 'bg-sky-300/50',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-sky-100 bg-white',
        crownClassName: 'text-sky-500',
        crownStrokeWidth: 2.2,
      },
      pro: {
        haloClassName: 'bg-violet-300/50',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-violet-100 bg-white',
        crownClassName: 'text-violet-500',
        crownStrokeWidth: 2.2,
      },
      max: {
        haloClassName: 'bg-amber-300/55',
        backClassName: '',
        orbitClassName: '',
        dotClassName: '',
        coreClassName: 'border-amber-100 bg-white',
        crownClassName: 'text-amber-500',
        crownStrokeWidth: 2.2,
      },
    },
  },
];
