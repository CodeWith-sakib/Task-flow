export type StateId = string;

export enum StateType {
  ATOMIC = 'ATOMIC',
  COMPOUND = 'COMPOUND',
  PARALLEL = 'PARALLEL',
  FINAL = 'FINAL',
  HISTORY = 'HISTORY'
}

export interface StateTransition {
  event: string;
  target: StateId;
  guard?: (context: any, eventPayload?: any) => boolean;
  actions?: ((context: any, eventPayload?: any) => void)[];
}

export interface StateNodeConfig {
  id: StateId;
  type?: StateType;
  initial?: StateId;
  entryActions?: ((context: any) => void)[];
  exitActions?: ((context: any) => void)[];
  transitions?: StateTransition[];
  children?: StateNodeConfig[];
  historyType?: 'shallow' | 'deep';
}

/**
 * StatechartNode represents a node in a hierarchical Harel Statechart tree.
 */
export class StatechartNode {
  public readonly id: StateId;
  public readonly type: StateType;
  public readonly initial?: StateId;
  public parent: StatechartNode | null = null;
  public children: Map<StateId, StatechartNode> = new Map();
  public transitions: StateTransition[] = [];
  public entryActions: ((context: any) => void)[] = [];
  public exitActions: ((context: any) => void)[] = [];
  public historyType: 'shallow' | 'deep' = 'shallow';
  public lastActiveHistory: StateId[] = [];

  constructor(config: StateNodeConfig) {
    this.id = config.id;
    this.type = config.type ?? (config.children && config.children.length > 0 ? StateType.COMPOUND : StateType.ATOMIC);
    this.initial = config.initial;
    this.transitions = config.transitions ?? [];
    this.entryActions = config.entryActions ?? [];
    this.exitActions = config.exitActions ?? [];
    this.historyType = config.historyType ?? 'shallow';

    if (config.children) {
      for (const childConfig of config.children) {
        const childNode = new StatechartNode(childConfig);
        childNode.parent = this;
        this.children.set(childNode.id, childNode);
      }
    }
  }

  public isLeaf(): boolean {
    return this.children.size === 0;
  }

  public findChild(id: StateId): StatechartNode | undefined {
    if (this.children.has(id)) {
      return this.children.get(id);
    }
    for (const child of this.children.values()) {
      const found = child.findChild(id);
      if (found) return found;
    }
    return undefined;
  }
}
