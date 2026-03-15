import { ChannelTransitionLab } from './playground/ChannelTransitionLab';

// Lab Registry: Add new experiments here
export const LAB_MODULES = [
  {
    id: 'channel-transition',
    label: 'Channel Motion',
    component: ChannelTransitionLab,
  },
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];
