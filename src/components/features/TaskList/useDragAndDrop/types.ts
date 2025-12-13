import { Priority, StoreTask } from '@/stores/useGroupStore';

export interface UseDragAndDropOptions {
  tasks: StoreTask[];
  activeGroupId: string | null;
  groups: { id: string; name: string; createdAt: number; pinned?: boolean }[];
  toggleCollapse: (taskId: string) => void;
  reorderTasks: (taskId: string, targetId: string) => void;
  crossStatusReorder: (taskId: string, targetId: string) => void;
  moveTaskToGroup: (taskId: string, groupId: string, targetId: string | null) => Promise<void>;
  updateTaskPriority: (taskId: string, priority: Priority) => void;
  setDraggingTaskId: (id: string | null) => void;
}
