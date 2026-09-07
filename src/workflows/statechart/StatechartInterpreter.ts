import { StatechartNode, StateId, StateNodeConfig, StateType } from './StatechartNode';

export interface StatechartSnapshot {
  configuration: StateId[];
  context: any;
  isDone: boolean;
}

/**
 * StatechartInterpreter executes hierarchical, orthogonal, and guarded statecharts
 * conforming to W3C SCXML / Harel Statechart semantics.
 */
export class StatechartInterpreter {
  private root: StatechartNode;
  private configuration: Set<StateId> = new Set();
  private context: any;
  private nodeMap: Map<StateId, StatechartNode> = new Map();
  private isDone: boolean = false;

  constructor(rootConfig: StateNodeConfig, initialContext: any = {}) {
    this.root = new StatechartNode(rootConfig);
    this.context = { ...initialContext };
    this.indexNodes(this.root);
  }

  public start(): StatechartSnapshot {
    this.enterInitialStates(this.root);
    return this.getSnapshot();
  }

  public send(event: string, eventPayload?: any): StatechartSnapshot {
    if (this.isDone) {
      return this.getSnapshot();
    }

    const transitionsToExecute: { from: StatechartNode; targetId: StateId; transition: any }[] = [];

    // Find enabled transitions in active configuration (inner-to-outer priority)
    for (const stateId of this.configuration) {
      let current: StatechartNode | null = this.nodeMap.get(stateId) || null;
      while (current) {
        for (const t of current.transitions) {
          if (t.event === event || t.event === '*') {
            const guardPasses = !t.guard || t.guard(this.context, eventPayload);
            if (guardPasses) {
              transitionsToExecute.push({ from: current, targetId: t.target, transition: t });
              break;
            }
          }
        }
        if (transitionsToExecute.length > 0) break;
        current = current.parent;
      }
    }

    if (transitionsToExecute.length > 0) {
      for (const item of transitionsToExecute) {
        this.executeTransition(item.from, item.targetId, item.transition, eventPayload);
      }
    }

    return this.getSnapshot();
  }

  public getSnapshot(): StatechartSnapshot {
    return {
      configuration: Array.from(this.configuration),
      context: { ...this.context },
      isDone: this.isDone
    };
  }

  public isInState(stateId: StateId): boolean {
    return this.configuration.has(stateId);
  }

  private executeTransition(fromNode: StatechartNode, targetId: StateId, transition: any, eventPayload?: any): void {
    const targetNode = this.nodeMap.get(targetId);
    if (!targetNode) return;

    // 1. Exit active states in the subtree being transitioned from
    this.exitSubtree(fromNode);

    // 2. Execute transition actions
    if (transition.actions) {
      for (const action of transition.actions) {
        action(this.context, eventPayload);
      }
    }

    // 3. Enter target state and its initial sub-states
    this.enterStateTree(targetNode);
  }

  private enterStateTree(node: StatechartNode): void {
    // Execute entry actions
    for (const action of node.entryActions) {
      action(this.context);
    }

    if (node.type === StateType.FINAL) {
      this.configuration.add(node.id);
      this.isDone = true;
      return;
    }

    if (node.type === StateType.ATOMIC) {
      this.configuration.add(node.id);
      return;
    }

    if (node.type === StateType.PARALLEL) {
      this.configuration.add(node.id);
      for (const child of node.children.values()) {
        this.enterStateTree(child);
      }
      return;
    }

    if (node.type === StateType.COMPOUND) {
      this.configuration.add(node.id);
      const initialChildId = node.initial || node.children.keys().next().value;
      if (initialChildId && node.children.has(initialChildId)) {
        this.enterStateTree(node.children.get(initialChildId)!);
      }
    }
  }

  private enterInitialStates(node: StatechartNode): void {
    this.enterStateTree(node);
  }

  private exitSubtree(node: StatechartNode): void {
    for (const stateId of Array.from(this.configuration)) {
      const activeNode = this.nodeMap.get(stateId);
      if (activeNode && this.isDescendantOrSelf(activeNode, node)) {
        for (const action of activeNode.exitActions) {
          action(this.context);
        }
        this.configuration.delete(stateId);
      }
    }
  }

  private isDescendantOrSelf(candidate: StatechartNode, ancestor: StatechartNode): boolean {
    let curr: StatechartNode | null = candidate;
    while (curr) {
      if (curr === ancestor) return true;
      curr = curr.parent;
    }
    return false;
  }

  private indexNodes(node: StatechartNode): void {
    this.nodeMap.set(node.id, node);
    for (const child of node.children.values()) {
      this.indexNodes(child);
    }
  }
}
