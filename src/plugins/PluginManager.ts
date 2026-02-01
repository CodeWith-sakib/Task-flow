import { Task, CreateTaskRequest, TaskStatus } from '../types';
import { TaskFlowPlugin } from './types';

export class PluginManager {
  private plugins: Map<string, TaskFlowPlugin> = new Map();

  async register(plugin: TaskFlowPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    if (plugin.init) {
      await plugin.init();
    }

    this.plugins.set(plugin.name, plugin);
  }

  async unregister(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.destroy) {
      await plugin.destroy();
    }

    return this.plugins.delete(name);
  }

  getPlugin(name: string): TaskFlowPlugin | null {
    return this.plugins.get(name) ?? null;
  }

  listPlugins(): TaskFlowPlugin[] {
    return Array.from(this.plugins.values());
  }

  async runBeforeCreateTask(request: CreateTaskRequest): Promise<CreateTaskRequest> {
    let current = { ...request };
    for (const plugin of this.plugins.values()) {
      if (plugin.beforeCreateTask) {
        try {
          current = await plugin.beforeCreateTask(current);
        } catch (err) {
          console.error(`Plugin '${plugin.name}' beforeCreateTask failed:`, err);
        }
      }
    }
    return current;
  }

  async runAfterCreateTask(task: Task): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.afterCreateTask) {
        try {
          await plugin.afterCreateTask(task);
        } catch (err) {
          console.error(`Plugin '${plugin.name}' afterCreateTask failed:`, err);
        }
      }
    }
  }

  async runBeforeExecuteTask(task: Task): Promise<Task> {
    let current = { ...task };
    for (const plugin of this.plugins.values()) {
      if (plugin.beforeExecuteTask) {
        try {
          current = await plugin.beforeExecuteTask(current);
        } catch (err) {
          console.error(`Plugin '${plugin.name}' beforeExecuteTask failed:`, err);
        }
      }
    }
    return current;
  }

  async runAfterExecuteTask(task: Task, success: boolean, result?: any, error?: string): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.afterExecuteTask) {
        try {
          await plugin.afterExecuteTask(task, success, result, error);
        } catch (err) {
          console.error(`Plugin '${plugin.name}' afterExecuteTask failed:`, err);
        }
      }
    }
  }

  async runOnStateTransition(task: Task, fromStatus: TaskStatus, toStatus: TaskStatus): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onStateTransition) {
        try {
          await plugin.onStateTransition(task, fromStatus, toStatus);
        } catch (err) {
          console.error(`Plugin '${plugin.name}' onStateTransition failed:`, err);
        }
      }
    }
  }
}
