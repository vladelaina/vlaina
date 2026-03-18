import { SidebarLoginEntryLab } from './playground/SidebarLoginEntryLab';
import { GoogleButtonLab } from './playground/GoogleButtonLab';

export const LAB_MODULES = [
  {
    id: 'sidebar-login-entry',
    label: 'Login Dialog',
    component: SidebarLoginEntryLab,
    description: 'Refined design directions for the sign-in dialog.',
  },
  {
    id: 'google-button-lab',
    label: 'Google Button',
    component: GoogleButtonLab,
    description: 'Thirty premium variants for the Google login action.',
  },
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];
