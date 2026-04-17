export type AutoPairSpec = {
  open: string;
  close: string;
  symmetric?: boolean;
};

const AUTO_PAIR_SPECS: AutoPairSpec[] = [
  { open: '(', close: ')' },
  { open: '（', close: '）' },
  { open: '[', close: ']' },
  { open: '【', close: '】' },
  { open: '{', close: '}' },
  { open: '「', close: '」' },
  { open: '『', close: '』' },
  { open: '《', close: '》' },
  { open: '〈', close: '〉' },
  { open: '“', close: '”' },
  { open: '‘', close: '’' },
  { open: '"', close: '"', symmetric: true },
  { open: "'", close: "'", symmetric: true },
];

export const openPairSpecs = new Map(AUTO_PAIR_SPECS.map((spec) => [spec.open, spec]));
export const closePairSpecs = new Map(AUTO_PAIR_SPECS.map((spec) => [spec.close, spec]));
