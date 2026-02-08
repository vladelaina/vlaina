import { getStorageAdapter, joinPath } from './adapter';
import type { ChatMessage } from '@/lib/ai/types';

export async function saveSessionJson(sessionId: string, messages: ChatMessage[]) {
  const storage = getStorageAdapter();
  const base = await storage.getBasePath();
  const chatRoot = await joinPath(base, '.nekotick', 'chat');
  const dir = await joinPath(chatRoot, 'sessions');
  
  if (!(await storage.exists(chatRoot))) {
      await storage.mkdir(chatRoot, true);
  }
  if (!(await storage.exists(dir))) {
      await storage.mkdir(dir, true);
  }
  
  const path = await joinPath(dir, `${sessionId}.json`);
  await storage.writeFile(path, JSON.stringify(messages, null, 2));
}

export async function loadSessionJson(sessionId: string): Promise<ChatMessage[] | null> {
  const storage = getStorageAdapter();
  const base = await storage.getBasePath();
  const path = await joinPath(base, '.nekotick', 'chat', 'sessions', `${sessionId}.json`);
  
  if (await storage.exists(path)) {
      try {
          const content = await storage.readFile(path);
          return JSON.parse(content);
      } catch (e) {
          return null;
      }
  }
  return null;
}
