export type AutoPairSpec = {
  open: string;
  close: string;
  symmetric?: boolean;
};

export const autoPairSpecs: AutoPairSpec[] = [
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

export const openPairSpecs = new Map(autoPairSpecs.map((spec) => [spec.open, spec]));
export const closePairSpecs = new Map(autoPairSpecs.map((spec) => [spec.close, spec]));
