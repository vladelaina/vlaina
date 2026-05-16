import type { ComponentType } from 'react';

export type LabModule = {
  id: string;
  label: string;
  icon: string;
  component: ComponentType;
  description: string;
};

export const LAB_MODULES: LabModule[] = [];

export type LabId = LabModule['id'];
