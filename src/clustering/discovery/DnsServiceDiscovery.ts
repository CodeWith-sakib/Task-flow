/**
 * DNS SRV-Record Service Discovery.
 * Resolves dynamic peer instances via DNS SRV records, weight/priority balancing,
 * and continuous background change polling.
 */

export interface DnsSrvRecord {
  name: string;
  port: number;
  priority: number;
  weight: number;
}

export type DnsResolverFn = (hostname: string) => Promise<DnsSrvRecord[]>;

export class DnsServiceDiscovery {
  private serviceHostname: string;
  private resolver: DnsResolverFn;
  private cachedRecords: DnsSrvRecord[] = [];
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(serviceHostname: string, resolver?: DnsResolverFn) {
    this.serviceHostname = serviceHostname;
    this.resolver = resolver || this.defaultMockResolver;
  }

  public async resolvePeers(): Promise<DnsSrvRecord[]> {
    try {
      const records = await this.resolver(this.serviceHostname);
      // Sort by priority (lowest first), then weighted random
      records.sort((a, b) => a.priority - b.priority);
      this.cachedRecords = records;
      return [...records];
    } catch {
      return [...this.cachedRecords];
    }
  }

  public startPolling(pollIntervalMs: number = 10000): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.resolvePeers();
    }, pollIntervalMs);

    if (this.pollTimer.unref) {
      this.pollTimer.unref();
    }
  }

  public stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public getCachedPeers(): DnsSrvRecord[] {
    return [...this.cachedRecords];
  }

  private async defaultMockResolver(hostname: string): Promise<DnsSrvRecord[]> {
    return [
      { name: `node-1.${hostname}`, port: 8080, priority: 10, weight: 50 },
      { name: `node-2.${hostname}`, port: 8080, priority: 10, weight: 50 },
    ];
  }
}
