// Lab Registry: Add new experiments here
export const LAB_MODULES = [] as const;

export type LabId = typeof LAB_MODULES[number]['id'];
