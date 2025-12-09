export class MetricsRegistry {
  private counters: Map<string, { value: number; labels?: Record<string, string>; help: string }> = new Map();
  private gauges: Map<string, { value: number; labels?: Record<string, string>; help: string }> = new Map();
  private histograms: Map<string, { buckets: number[]; counts: number[]; sum: number; count: number; help: string }> = new Map();

  incrementCounter(name: string, help: string = '', amount: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      this.counters.set(key, { value: amount, labels, help });
    }
  }

  setGauge(name: string, value: number, help: string = '', labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, { value, labels, help });
  }

  registerHistogram(name: string, help: string, buckets: number[] = [10, 50, 100, 250, 500, 1000, 2500, 5000]): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        buckets: [...buckets].sort((a, b) => a - b),
        counts: new Array(buckets.length + 1).fill(0),
        sum: 0,
        count: 0,
        help,
      });
    }
  }

  observeHistogram(name: string, value: number): void {
    let hist = this.histograms.get(name);
    if (!hist) {
      this.registerHistogram(name, '');
      hist = this.histograms.get(name)!;
    }

    hist.sum += value;
    hist.count++;

    let placed = false;
    for (let i = 0; i < hist.buckets.length; i++) {
      if (value <= hist.buckets[i]) {
        hist.counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) {
      hist.counts[hist.buckets.length]++;
    }
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  exportPrometheusText(): string {
    const lines: string[] = [];

    // Export counters
    for (const [key, data] of this.counters.entries()) {
      const baseName = key.split('{')[0];
      if (data.help) lines.push(`# HELP ${baseName} ${data.help}`);
      lines.push(`# TYPE ${baseName} counter`);
      lines.push(`${key} ${data.value}`);
    }

    // Export gauges
    for (const [key, data] of this.gauges.entries()) {
      const baseName = key.split('{')[0];
      if (data.help) lines.push(`# HELP ${baseName} ${data.help}`);
      lines.push(`# TYPE ${baseName} gauge`);
      lines.push(`${key} ${data.value}`);
    }

    // Export histograms
    for (const [name, hist] of this.histograms.entries()) {
      if (hist.help) lines.push(`# HELP ${name} ${hist.help}`);
      lines.push(`# TYPE ${name} histogram`);

      let cumulative = 0;
      for (let i = 0; i < hist.buckets.length; i++) {
        cumulative += hist.counts[i];
        lines.push(`${name}_bucket{le="${hist.buckets[i]}"} ${cumulative}`);
      }
      cumulative += hist.counts[hist.buckets.length];
      lines.push(`${name}_bucket{le="+Inf"} ${cumulative}`);
      lines.push(`${name}_sum ${hist.sum}`);
      lines.push(`${name}_count ${hist.count}`);
    }

    return lines.join('\n') + '\n';
  }

  getCounterValue(name: string): number {
    return this.counters.get(name)?.value ?? 0;
  }

  getGaugeValue(name: string): number {
    return this.gauges.get(name)?.value ?? 0;
  }

  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}
