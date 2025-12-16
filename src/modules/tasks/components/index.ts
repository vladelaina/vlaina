// Tasks module components
// 重新导出现有组件，保持向后兼容

// 任务项组件
export { TaskItem } from '@/components/features/TaskItem';

// 任务列表组件
export { TaskList } from '@/components/features/TaskList/TaskList';
export { CompletedSection } from '@/components/features/TaskList/CompletedSection';
export { ArchiveTaskList } from '@/components/features/TaskList/ArchiveTaskList';
export { SubTaskModal } from '@/components/features/TaskList/SubTaskModal';

// 任务输入组件
export { TaskInput } from '@/components/features/TaskInput';

// 分组侧边栏组件
export { GroupSidebar } from '@/components/features/GroupDrawer/GroupSidebar';
export { SortableGroupItem } from '@/components/features/GroupDrawer/SortableGroupItem';
export { GroupToolbar } from '@/components/features/GroupDrawer/GroupToolbar';
export type { SortOption } from '@/components/features/GroupDrawer/GroupToolbar';
export { IconButton } from '@/components/features/GroupDrawer/IconButton';

// 其他功能组件
export { CommandMenu } from '@/components/features/CommandMenu';
export { ShortcutsDialog } from '@/components/features/ShortcutsDialog';
export { ActivityHeatmap } from '@/components/features/ActivityHeatmap';
