import { 
  readTextFile, 
  writeTextFile, 
  exists, 
  mkdir,
  BaseDirectory 
} from '@tauri-apps/plugin-fs';
import type { Task, StorageRepository } from '@/types';
import { parseMarkdown, serializeToMarkdown, createEmptyMarkdown } from '@/lib/markdown';

const NEKOTICK_DIR = 'NekoTick';
const TASKS_FILE = 'nekotick.md';
const FULL_PATH = `${NEKOTICK_DIR}/${TASKS_FILE}`;

/**
 * Local File System Storage Strategy
 * Implements StorageRepository using Tauri's file system APIs
 */
export class LocalStorageRepository implements StorageRepository {
  private initialized = false;

  /**
   * Ensure the NekoTick directory and file exist
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if directory exists
      const dirExists = await exists(NEKOTICK_DIR, { 
        baseDir: BaseDirectory.Document 
      });
      
      if (!dirExists) {
        await mkdir(NEKOTICK_DIR, { 
          baseDir: BaseDirectory.Document,
          recursive: true 
        });
      }

      // Check if file exists
      const fileExists = await exists(FULL_PATH, { 
        baseDir: BaseDirectory.Document 
      });
      
      if (!fileExists) {
        await writeTextFile(FULL_PATH, createEmptyMarkdown(), { 
          baseDir: BaseDirectory.Document 
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  async getTasks(): Promise<Task[]> {
    await this.ensureInitialized();
    
    try {
      const content = await readTextFile(FULL_PATH, { 
        baseDir: BaseDirectory.Document 
      });
      return parseMarkdown(content);
    } catch (error) {
      console.error('Failed to read tasks:', error);
      return [];
    }
  }

  async saveTask(task: Task): Promise<void> {
    const tasks = await this.getTasks();
    tasks.push(task);
    await this.writeTasks(tasks);
  }

  async updateTask(task: Task): Promise<void> {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index !== -1) {
      tasks[index] = task;
      await this.writeTasks(tasks);
    }
  }

  async deleteTask(id: string): Promise<void> {
    const tasks = await this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    await this.writeTasks(filtered);
  }

  /**
   * Bulk save all tasks (used for syncing state)
   */
  async saveTasks(tasks: Task[]): Promise<void> {
    await this.ensureInitialized();
    await this.writeTasks(tasks);
  }

  private async writeTasks(tasks: Task[]): Promise<void> {
    try {
      const header = '# Nekotick Tasks\n\n';
      const content = header + serializeToMarkdown(tasks);
      await writeTextFile(FULL_PATH, content, { 
        baseDir: BaseDirectory.Document 
      });
    } catch (error) {
      console.error('Failed to write tasks:', error);
      throw error;
    }
  }
}

// Singleton instance
export const localStorageRepo = new LocalStorageRepository();
