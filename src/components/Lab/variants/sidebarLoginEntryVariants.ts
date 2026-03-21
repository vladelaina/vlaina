export type SidebarLoginEntryVariant = {
  id: string;
  name: string;
  category: string;
  stageBg: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  googleBtn: string;
  googleBadge?: string;
  emailInput: string;
  submitBtn: string;
  legalNote: string;
  customStyles?: {
    card?: React.CSSProperties;
  };
};

export const sidebarLoginEntryVariants: SidebarLoginEntryVariant[] = [
  {
    id: 'high-contrast-rounded',
    name: 'Stark Flow',
    category: 'Modern Mono',
    stageBg: 'bg-white',
    cardBg: 'bg-white',
    cardBorder: 'border-zinc-100 rounded-[80px]',
    cardShadow: 'shadow-[0_60px_120px_rgba(0,0,0,0.05)]',
    googleBtn: 'bg-black text-white rounded-full h-20 font-black uppercase tracking-widest text-xs shadow-2xl',
    emailInput: 'bg-zinc-50 border-transparent focus:bg-white focus:ring-2 focus:ring-black rounded-full h-16 px-10 text-lg',
    submitBtn: 'bg-zinc-100 text-zinc-400 hover:bg-black hover:text-white rounded-full h-16 font-black uppercase tracking-widest',
    legalNote: 'text-zinc-400',
  },
  {
    id: 'signature-clay-pro',
    name: 'Neumorph Pro',
    category: 'Signature',
    stageBg: 'bg-[#f0f0f3]',
    cardBg: 'bg-[#f0f0f3]',
    cardBorder: 'border-white/50 border-2 rounded-[50px]',
    cardShadow: 'shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff]',
    googleBtn: 'bg-[#f0f0f3] shadow-[6px_6px_12px_#d1d1d6,-6px_-6px_12px_#ffffff] rounded-3xl h-16 text-zinc-900 font-bold',
    emailInput: 'bg-[#f0f0f3] shadow-[inset_6px_6px_12px_#d1d1d6,inset_-6px_-6px_12px_#ffffff] rounded-3xl border-none h-16 px-8',
    submitBtn: 'bg-zinc-900 text-white rounded-3xl h-16 font-black shadow-2xl shadow-zinc-400 active:shadow-inner transition-all',
    legalNote: 'text-zinc-400',
  },
  {
    id: 'ceramic-white',
    name: 'Ceramic Pro',
    category: 'Industrial',
    stageBg: 'bg-zinc-50',
    cardBg: 'bg-white shadow-[inset:0_0_20px_rgba(255,255,255,1)]',
    cardBorder: 'border-white border-4 rounded-[60px]',
    cardShadow: 'shadow-[0_40px_80px_rgba(0,0,0,0.05)]',
    googleBtn: 'bg-zinc-950 text-white rounded-full h-16 shadow-2xl hover:scale-[1.02]',
    emailInput: 'bg-zinc-50 border-transparent focus:bg-white focus:ring-1 focus:ring-zinc-100 rounded-3xl h-16 px-10 font-bold',
    submitBtn: 'bg-white text-zinc-950 border-2 border-zinc-100 rounded-full h-16 font-black shadow-lg',
    legalNote: 'text-zinc-300',
  },
  {
    id: 'ethereal-pure',
    name: 'Ethereal Flow',
    category: 'Visionary Glass',
    stageBg: 'bg-white',
    cardBg: 'bg-white',
    cardBorder: 'border-zinc-50 rounded-[80px]',
    cardShadow: 'shadow-[0_80px_160px_rgba(0,0,0,0.04)]',
    googleBtn: 'bg-zinc-950 text-white rounded-full h-16 transition-all hover:scale-105',
    emailInput: 'bg-zinc-50/50 border-transparent focus:bg-white focus:ring-4 focus:ring-zinc-50 rounded-full h-16 px-10 text-center',
    submitBtn: 'bg-zinc-100 text-zinc-400 hover:text-zinc-900 rounded-full h-16 font-black',
    legalNote: 'text-zinc-200',
  },
  {
    id: 'phantom-white',
    name: 'Phantom Layer',
    category: 'Visionary Glass',
    stageBg: 'bg-zinc-50',
    cardBg: 'bg-white/40 backdrop-blur-xl',
    cardBorder: 'border-white border-4 rounded-[48px]',
    cardShadow: 'shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)]',
    googleBtn: 'bg-white text-zinc-900 rounded-[24px] h-14 shadow-lg shadow-zinc-200',
    emailInput: 'bg-white/20 border-white/40 focus:bg-white/60 rounded-[20px] h-14 px-6 border-2',
    submitBtn: 'bg-zinc-950 text-white rounded-[24px] h-14 font-black',
    legalNote: 'text-zinc-400',
  },
  {
    id: 'aero-monochrome',
    name: 'Aero Mono',
    category: 'Visionary Glass',
    stageBg: 'bg-white',
    cardBg: 'bg-zinc-50/10 backdrop-blur-[100px]',
    cardBorder: 'border-zinc-200/30 rounded-[60px]',
    cardShadow: 'shadow-none',
    googleBtn: 'bg-zinc-950 text-white rounded-full h-14',
    emailInput: 'bg-zinc-100/50 border-none focus:bg-white rounded-3xl h-14 px-8',
    submitBtn: 'bg-zinc-100 text-zinc-400 hover:text-zinc-900 rounded-full h-14 font-black transition-all',
    legalNote: 'text-zinc-300',
  },
];
