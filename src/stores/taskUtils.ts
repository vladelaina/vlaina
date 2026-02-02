import type { NekoEvent } from './types';
import { MS_PER_MINUTE } from '@/lib/time/constants';

export function collectTaskAndDescendants(
  task: NekoEvent,
  allTasks: NekoEvent[]
): NekoEvent[] {
  const result: NekoEvent[] = [task];
  const children = allTasks.filter(t => t.parentId === task.uid);
  children.forEach(child => {
    result.push(...collectTaskAndDescendants(child, allTasks));
  });
  return result;
}

export function calculateActualTime(
  createdAt: number,
  isCompleting: boolean
): number | undefined {
  if (!isCompleting) {
    return undefined;
  }
  
  const now = Date.now();
  const elapsedMs = now - createdAt;
  
  if (elapsedMs <= 0 || elapsedMs >= 8640000000) {
    return undefined;
  }
  
  let actualMinutes = elapsedMs / MS_PER_MINUTE;
  
  if (actualMinutes < 1 / 60 && elapsedMs > 0) {
    actualMinutes = 1 / 60;
  }
  
  return actualMinutes;
}
