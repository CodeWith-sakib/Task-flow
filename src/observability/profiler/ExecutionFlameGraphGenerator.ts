/**
 * Execution Flame Graph & Performance Profile Generator.
 * Collects hierarchical span execution profiles, calculates self-time vs cumulative time,
 * and formats profiles into folded-stack or SpeedScope-compatible JSON structures.
 */

export interface ProfileFrame {
  id: string;
  name: string;
  category: 'workflow' | 'task' | 'db' | 'network' | 'compute';
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  selfDurationMs: number;
  children: ProfileFrame[];
  metadata?: Record<string, any>;
}

export class ExecutionFlameGraphGenerator {
  private activeSpans = new Map<string, { frame: ProfileFrame; parentId?: string }>();
  private completedTrees: ProfileFrame[] = [];

  public startSpan(
    id: string,
    name: string,
    category: ProfileFrame['category'] = 'compute',
    parentId?: string,
    metadata?: Record<string, any>
  ): void {
    const frame: ProfileFrame = {
      id,
      name,
      category,
      startTimeMs: Date.now(),
      endTimeMs: 0,
      durationMs: 0,
      selfDurationMs: 0,
      children: [],
      metadata,
    };

    this.activeSpans.set(id, { frame, parentId });
  }

  public endSpan(id: string): ProfileFrame | undefined {
    const entry = this.activeSpans.get(id);
    if (!entry) return undefined;

    const { frame, parentId } = entry;
    frame.endTimeMs = Date.now();
    frame.durationMs = Math.max(0, frame.endTimeMs - frame.startTimeMs);

    // Calculate self duration = total duration - sum(children total durations)
    const childDurations = frame.children.reduce((acc, c) => acc + c.durationMs, 0);
    frame.selfDurationMs = Math.max(0, frame.durationMs - childDurations);

    this.activeSpans.delete(id);

    if (parentId && this.activeSpans.has(parentId)) {
      this.activeSpans.get(parentId)!.frame.children.push(frame);
    } else {
      this.completedTrees.push(frame);
    }

    return frame;
  }

  public getCompletedProfiles(): ProfileFrame[] {
    return [...this.completedTrees];
  }

  /**
   * Converts recorded profiles to Brendan Gregg's Folded Stacks format for flamegraph rendering:
   * "main;workflow;taskA 120"
   */
  public toFoldedStacks(): string[] {
    const lines: string[] = [];

    for (const root of this.completedTrees) {
      this.traverseFolded(root, '', lines);
    }

    return lines;
  }

  /**
   * Generates a hierarchical JSON profile.
   */
  public toSpeedScopeProfile(): Record<string, any> {
    return {
      version: '0.0.1',
      $schema: 'https://www.speedscope.app/file-format-spec.json',
      shared: {
        frames: this.collectAllFrames(),
      },
      profiles: this.completedTrees.map((tree) => ({
        type: 'evented',
        name: tree.name,
        unit: 'milliseconds',
        startValue: tree.startTimeMs,
        endValue: tree.endTimeMs,
        events: this.buildEventStream(tree),
      })),
    };
  }

  private traverseFolded(node: ProfileFrame, prefix: string, lines: string[]): void {
    const currentPath = prefix ? `${prefix};${node.name}` : node.name;

    if (node.selfDurationMs > 0) {
      lines.push(`${currentPath} ${Math.round(node.selfDurationMs)}`);
    }

    for (const child of node.children) {
      this.traverseFolded(child, currentPath, lines);
    }
  }

  private collectAllFrames(): { name: string }[] {
    const names = new Set<string>();
    const scan = (node: ProfileFrame) => {
      names.add(node.name);
      node.children.forEach(scan);
    };
    this.completedTrees.forEach(scan);
    return Array.from(names).map((name) => ({ name }));
  }

  private buildEventStream(node: ProfileFrame): any[] {
    const events: any[] = [];
    events.push({ type: 'O', frame: node.name, at: node.startTimeMs });
    for (const child of node.children) {
      events.push(...this.buildEventStream(child));
    }
    events.push({ type: 'C', frame: node.name, at: node.endTimeMs });
    return events;
  }
}
