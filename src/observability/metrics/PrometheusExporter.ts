export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricEntry {
  name: string;
  help: string;
  type: MetricType;
  labels: Record<string, string>;
  value: number;
}

/**
 * PrometheusExporter generates OpenMetrics / Prometheus text representation for multidimensional metrics.
 */
export class PrometheusExporter {
  private metrics: Map<string, MetricEntry[]> = new Map();

  public register(name: string, help: string, type: MetricType, labels: Record<string, string>, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const entries = this.metrics.get(name)!;
    const existingIdx = entries.findIndex(e => this.labelsEqual(e.labels, labels));

    if (existingIdx !== -1) {
      entries[existingIdx].value = value;
    } else {
      entries.push({ name, help, type, labels, value });
    }
  }

  public renderText(): string {
    const lines: string[] = [];

    for (const [name, entries] of this.metrics.entries()) {
      if (entries.length === 0) continue;
      const first = entries[0];
      lines.push(`# HELP ${name} ${first.help}`);
      lines.push(`# TYPE ${name} ${first.type}`);

      for (const entry of entries) {
        const labelStr = this.formatLabels(entry.labels);
        lines.push(`${name}${labelStr} ${entry.value}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  public clear(): void {
    this.metrics.clear();
  }

  private formatLabels(labels: Record<string, string>): string {
    const keys = Object.keys(labels);
    if (keys.length === 0) return '';
    const formatted = keys.map(k => `${k}="${labels[k]}"`).join(',');
    return `{${formatted}}`;
  }

  private labelsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => a[k] === b[k]);
  }
}
