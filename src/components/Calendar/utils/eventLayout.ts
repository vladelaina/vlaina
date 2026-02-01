import { type ItemColor, getColorPriority } from '@/lib/colors';

interface LayoutEvent {
  id: string;
  startDate: number;
  endDate: number;
  color?: ItemColor;
  completed?: boolean;
}

export interface EventLayoutInfo {
  id: string;
  column: number;
  totalColumns: number;
  leftPercent: number;
  widthPercent: number;
}

function eventsOverlap(a: LayoutEvent, b: LayoutEvent): boolean {
  return a.startDate < b.endDate && a.endDate > b.startDate;
}

function findOverlapGroups(events: LayoutEvent[]): LayoutEvent[][] {
  if (events.length === 0) return [];
  
  const visited = new Set<string>();
  const groups: LayoutEvent[][] = [];
  
  for (const event of events) {
    if (visited.has(event.id)) continue;
    
    const group: LayoutEvent[] = [];
    const queue: LayoutEvent[] = [event];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      
      visited.add(current.id);
      group.push(current);
      
      for (const other of events) {
        if (!visited.has(other.id) && eventsOverlap(current, other)) {
          queue.push(other);
        }
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

function layoutGroup(events: LayoutEvent[]): Map<string, EventLayoutInfo> {
  const result = new Map<string, EventLayoutInfo>();
  
  if (events.length === 0) return result;
  
  if (events.length === 1) {
    const event = events[0];
    result.set(event.id, {
      id: event.id,
      column: 0,
      totalColumns: 1,
      leftPercent: 0,
      widthPercent: 100,
    });
    return result;
  }
  
  const sorted = [...events].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate - b.startDate;
    
    const completedA = a.completed ? 1 : 0;
    const completedB = b.completed ? 1 : 0;
    if (completedA !== completedB) return completedA - completedB;
    
    const idSort = a.id.localeCompare(b.id);
    if (idSort !== 0) return idSort;

    const colorOrderA = getColorPriority(a.color);
    const colorOrderB = getColorPriority(b.color);
    if (colorOrderA !== colorOrderB) return colorOrderA - colorOrderB;
    
    return 0;
  });
  
  const eventColumns = new Map<string, number>();
  
  for (const event of sorted) {
    const occupiedColumns = new Set<number>();
    
    for (const other of sorted) {
      if (other.id === event.id) continue;
      if (!eventColumns.has(other.id)) continue;
      
      if (eventsOverlap(event, other)) {
        occupiedColumns.add(eventColumns.get(other.id)!);
      }
    }
    
    let column = 0;
    while (occupiedColumns.has(column)) {
      column++;
    }
    
    eventColumns.set(event.id, column);
  }
  
  let maxColumn = 0;
  for (const column of eventColumns.values()) {
    maxColumn = Math.max(maxColumn, column);
  }
  const totalColumns = maxColumn + 1;
  
  const columnWidth = 100 / totalColumns;
  
  for (const event of events) {
    const column = eventColumns.get(event.id) || 0;
    const leftPercent = column * columnWidth;
    
    result.set(event.id, {
      id: event.id,
      column,
      totalColumns,
      leftPercent,
      widthPercent: columnWidth,
    });
  }
  
  return result;
}

export function calculateEventLayout(
  events: LayoutEvent[]
): Map<string, EventLayoutInfo> {
  const result = new Map<string, EventLayoutInfo>();
  
  if (events.length === 0) return result;
  
  const groups = findOverlapGroups(events);
  
  for (const group of groups) {
    const groupLayout = layoutGroup(group);
    for (const [id, layout] of groupLayout) {
      result.set(id, layout);
    }
  }
  
  return result;
}