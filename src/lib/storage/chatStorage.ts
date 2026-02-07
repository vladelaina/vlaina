import { getStorageAdapter, joinPath } from './adapter';
import type { ChatMessage, ChatSession } from '@/lib/ai/types';

const CHAT_DIR = 'chats';

async function getChatDir() {
  const storage = getStorageAdapter();
  const base = await storage.getBasePath();
  const chatPath = await joinPath(base, '.nekotick', CHAT_DIR);
  if (!(await storage.exists(chatPath))) {
      await storage.mkdir(chatPath, true);
  }
  return chatPath;
}

function formatMessageToMarkdown(msg: ChatMessage): string {
  return `\n\n### ${msg.role} (${msg.id})\n${msg.content}`;
}

export async function saveSessionToMarkdown(session: ChatSession, messages: ChatMessage[]) {
  const storage = getStorageAdapter();
  const dir = await getChatDir();
  const filePath = await joinPath(dir, `${session.id}.md`);

  const frontmatter = [
      '---',
      `id: ${session.id}`,
      `title: ${session.title}`,
      `model: ${session.modelId}`,
      `created: ${session.createdAt}`,
      `updated: ${session.updatedAt}`,
      '---',
      '',
      `# ${session.title}`,
      ''
  ].join('\n');

  const body = messages.map(formatMessageToMarkdown).join('');
  await storage.writeFile(filePath, frontmatter + body);
}

export async function appendMessageToMarkdown(sessionId: string, message: ChatMessage) {
    const storage = getStorageAdapter();
    const dir = await getChatDir();
    const filePath = await joinPath(dir, `${sessionId}.md`);
    
    let content = '';
    if (await storage.exists(filePath)) {
        content = await storage.readFile(filePath);
    }
    
    const newBlock = formatMessageToMarkdown(message);
    await storage.writeFile(filePath, content + newBlock);
}

export async function deleteSessionMarkdown(sessionId: string) {
    const storage = getStorageAdapter();
    const dir = await getChatDir();
    const filePath = await joinPath(dir, `${sessionId}.md`);
    
    if (await storage.exists(filePath)) {
        await storage.deleteFile(filePath);
    }
}

export async function loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const storage = getStorageAdapter();
    const dir = await getChatDir();
    const filePath = await joinPath(dir, `${sessionId}.md`);
    
    if (!(await storage.exists(filePath))) return [];
    
    const content = await storage.readFile(filePath);
    const messages: ChatMessage[] = [];
    
    const parts = content.split(/\n### (user|assistant|system) \((.*?)\)\n/);
    
    for (let i = 1; i < parts.length; i += 3) {
        const role = parts[i] as 'user' | 'assistant' | 'system';
        const id = parts[i+1];
        const text = parts[i+2]?.trim() || '';
        
        messages.push({
            id,
            role,
            content: text,
            timestamp: Date.now(),
            modelId: ''
        });
    }
    
    return messages;
}
