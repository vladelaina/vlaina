import { SidebarLoginEntryLab } from './playground/SidebarLoginEntryLab';
import { GoogleButtonLab } from './playground/GoogleButtonLab';
import { MembershipBadgeLab } from './playground/MembershipBadgeLab';

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
  {
    id: 'membership-badge-lab',
    label: 'Membership Badge',
    component: MembershipBadgeLab,
    description: 'Thirty display directions for Free, Pro, MAX, and Ultra.',
  },
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];
