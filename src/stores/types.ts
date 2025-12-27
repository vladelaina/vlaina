// Store types and interfaces

// 从统一颜色系统导入
export { type ItemColor } from '@/lib/colors';

export interface Group {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  pinned?: boolean;
}

// View mode type
export type ViewMode = 'day' | 'week' | 'month';

// StoreTask type for archive components
// 注意：ItemColor 从 @/lib/colors 导入
import type { ItemColor as ColorType } from '@/lib/colors';

export interface StoreTask {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  order: number;
  groupId: string;
  parentId: string | null;
  collapsed: boolean;
  color: ColorType;
  estimatedMinutes?: number;
  actualMinutes?: number;
  startDate?: number;
  endDate?: number;
  isAllDay?: boolean;
}

// Archive time view type
export type ArchiveTimeView = 'day' | 'week' | 'month';
