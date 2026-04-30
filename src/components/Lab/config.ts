import { ChatSidebarLoadingLab } from './playground/ChatSidebarLoadingLab';
import { CoreNavigationLab } from './playground/CoreNavigationLab';
import { SidebarResizeLab } from './playground/SidebarResizeLab';
import { FirstPrinciplesLinkEditor } from './playground/FirstPrinciplesLinkEditor';
import { SearchDesignLab } from './playground/SearchDesignLab';

export const LAB_MODULES = [
  {
    id: 'search-design-20',
    label: 'Search Design 20',
    icon: 'common.search',
    component: SearchDesignLab,
    description: '20 Apple-style architectural solutions for the Find/Replace experience. From Dynamic Island to Spotlight.'
  },
  {
    id: 'sidebar-resize',
    label: 'Sidebar Resize',
    icon: 'misc.animation',
    component: SidebarResizeLab,
    description: '30 interaction directions for improving sidebar drag feel, discovery, and commit behavior.'
  },
  {
    id: 'core-navigation',
    label: 'Navigation Director',
    icon: 'misc.animation',
    component: CoreNavigationLab,
    description: '30 Apple-style architectural solutions for Chat & Notes switching.'
  },
  {
    id: 'fp-link-editor',
    label: 'FP: Link Editor',
    icon: 'misc.lab',
    component: FirstPrinciplesLinkEditor,
    description: '50 first-principles directions for note link editing. From the 1px rail to the chrono-trace veil.'
  },
  {
    id: 'chat-sidebar-loading',
    label: 'Sidebar Loading',
    icon: 'misc.animation',
    component: ChatSidebarLoadingLab,
    description: 'Ten interaction directions for replacing the yellow in-progress dot in the chat sidebar.'
  }
] as const;

export type LabId = typeof LAB_MODULES[number]['id'];
