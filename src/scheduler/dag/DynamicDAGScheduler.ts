/**
 * Dynamic Runtime DAG Scheduler.
 * Supports runtime dynamic task injection, conditional branch pruning,
 * fan-out/fan-in map-reduce workflow steps, and parallel topological scheduling.
 */

export interface DynamicDAGNode {
  id: string;
  action: (inputs: Record<string, any>) => Promise<any>;
  dependencies: string[];
  condition?: (inputs: Record<string, any>) => boolean;
  fanOutGenerator?: (inputs: Record<string, any>) => { id: string; input: any }[];
}

export interface DAGNodeExecutionState {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  output?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export class DynamicDAGScheduler {
  private nodes = new Map<string, DynamicDAGNode>();
  private states = new Map<string, DAGNodeExecutionState>();

  public addNode(node: DynamicDAGNode): void {
    this.nodes.set(node.id, node);
    this.states.set(node.id, { id: node.id, status: 'PENDING' });
  }

  public async execute(initialInput: Record<string, any> = {}): Promise<Map<string, DAGNodeExecutionState>> {
    let hasProgress = true;

    while (hasProgress) {
      hasProgress = false;
      const readyNodes: DynamicDAGNode[] = [];

      for (const [id, node] of this.nodes.entries()) {
        const state = this.states.get(id)!;
        if (state.status !== 'PENDING') continue;

        // Check if all dependencies are resolved
        const depsResolved = node.dependencies.every((depId) => {
          const depState = this.states.get(depId);
          return depState && (depState.status === 'COMPLETED' || depState.status === 'SKIPPED');
        });

        if (depsResolved) {
          readyNodes.push(node);
        }
      }

      if (readyNodes.length === 0) {
        break;
      }

      // Execute ready nodes concurrently
      const executions = readyNodes.map(async (node) => {
        const state = this.states.get(node.id)!;

        // Collect inputs from dependencies
        const inputs: Record<string, any> = { ...initialInput };
        for (const depId of node.dependencies) {
          const depState = this.states.get(depId);
          if (depState && depState.output !== undefined) {
            inputs[depId] = depState.output;
          }
        }

        // Check condition for skipping
        if (node.condition && !node.condition(inputs)) {
          state.status = 'SKIPPED';
          return;
        }

        // Check dynamic fan-out
        if (node.fanOutGenerator) {
          const items = node.fanOutGenerator(inputs);
          const dynamicOutputs: any[] = [];

          for (const item of items) {
            const res = await node.action({ ...inputs, item: item.input });
            dynamicOutputs.push(res);
          }

          state.status = 'COMPLETED';
          state.output = dynamicOutputs;
          return;
        }

        state.status = 'RUNNING';
        state.startedAt = Date.now();

        try {
          const output = await node.action(inputs);
          state.status = 'COMPLETED';
          state.output = output;
          state.completedAt = Date.now();
        } catch (err: any) {
          state.status = 'FAILED';
          state.error = err.message || String(err);
          state.completedAt = Date.now();
        }
      });

      await Promise.all(executions);
      hasProgress = true;
    }

    return new Map(this.states);
  }

  public getNodeState(nodeId: string): DAGNodeExecutionState | undefined {
    return this.states.get(nodeId);
  }
}
