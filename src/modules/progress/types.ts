/**
 * Progress Module Types
 * 进度追踪模块类型定义
 */

export interface ProgressItem {
  id: string;
  type: 'progress';
  title: string;
  icon?: string;
  direction: 'increment' | 'decrement';
  total: number;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>; // { "2025-12-05": 3, ... } 每天操作次数
  startDate?: number;
  endDate?: number;
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt: number;
  archived?: boolean;
}

export interface CounterItem {
  id: string;
  type: 'counter';
  title: string;
  icon?: string;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>;
  frequency: 'daily' | 'weekly' | 'monthly';
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt: number;
  archived?: boolean;
}

export type ProgressOrCounter = ProgressItem | CounterItem;

// 创建进度条的输入数据
export type CreateProgressInput = Omit<ProgressItem, 'id' | 'type' | 'current' | 'todayCount' | 'createdAt'>;

// 创建计数器的输入数据
export interface CreateCounterInput {
  title: string;
  icon?: string;
  step: number;
  unit: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
}
