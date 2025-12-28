// Store types and interfaces

// 从统一颜色系统导入
export { type ItemColor } from '@/lib/colors';

// 从统一日期系统导入
export { type TimeView } from '@/lib/date';

export interface Group {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  pinned?: boolean;
}

// StoreTask type for archive components
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
