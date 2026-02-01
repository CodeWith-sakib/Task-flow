import { PluginManager } from '../../src/plugins/PluginManager';
import { TaskFlowPlugin } from '../../src/plugins/types';
import { CreateTaskRequest } from '../../src/types';

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
  });

  it('should register plugins and execute beforeCreateTask hooks', async () => {
    const testPlugin: TaskFlowPlugin = {
      name: 'tagger',
      version: '1.0.0',
      beforeCreateTask: async (req: CreateTaskRequest) => {
        return {
          ...req,
          payload: { ...req.payload, __taggedByPlugin: true },
        };
      },
    };

    await pluginManager.register(testPlugin);
    expect(pluginManager.getPlugin('tagger')).not.toBeNull();

    const transformed = await pluginManager.runBeforeCreateTask({
      type: 'email',
      payload: { to: 'a@b.com' },
    });

    expect(transformed.payload.__taggedByPlugin).toBe(true);
  });

  it('should handle unregister and lifecycle teardown', async () => {
    let destroyed = false;
    const testPlugin: TaskFlowPlugin = {
      name: 'ephemeral',
      version: '1.0.0',
      destroy: async () => {
        destroyed = true;
      },
    };

    await pluginManager.register(testPlugin);
    const removed = await pluginManager.unregister('ephemeral');

    expect(removed).toBe(true);
    expect(destroyed).toBe(true);
    expect(pluginManager.getPlugin('ephemeral')).toBeNull();
  });
});
