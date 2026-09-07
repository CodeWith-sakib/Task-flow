/**
 * Multi-Tenant Cost Allocation & Resource Metering Engine.
 * Calculates billing attribution across compute seconds, memory-gigabyte-hours,
 * network egress, storage volume tiers, and API call volumes.
 */

export interface BillingRates {
  computeSecPrice: number; // cost per CPU-second
  memoryGbHourPrice: number; // cost per GB-hour
  storageGbMonthPrice: number; // cost per GB-month
  networkEgressGbPrice: number; // cost per GB egress
  apiCallPricePerThousand: number;
}

export interface TenantResourceConsumption {
  tenantId: string;
  computeMs: number;
  memoryMbMs: number;
  storageBytes: number;
  egressBytes: number;
  apiCallsCount: number;
}

export interface TenantInvoice {
  tenantId: string;
  periodStartTs: number;
  periodEndTs: number;
  computeCost: number;
  memoryCost: number;
  storageCost: number;
  networkCost: number;
  apiCallCost: number;
  totalCost: number;
}

export class CostAllocationEngine {
  private rates: BillingRates;
  private tenantUsage = new Map<string, TenantResourceConsumption>();

  constructor(rates?: Partial<BillingRates>) {
    this.rates = {
      computeSecPrice: 0.00002, // $0.072/hr
      memoryGbHourPrice: 0.004,
      storageGbMonthPrice: 0.02,
      networkEgressGbPrice: 0.05,
      apiCallPricePerThousand: 0.001,
      ...rates,
    };
  }

  public recordUsage(
    tenantId: string,
    usage: {
      computeMs?: number;
      memoryMb?: number;
      durationMs?: number;
      storageBytes?: number;
      egressBytes?: number;
      apiCalls?: number;
    }
  ): void {
    let current = this.tenantUsage.get(tenantId);
    if (!current) {
      current = {
        tenantId,
        computeMs: 0,
        memoryMbMs: 0,
        storageBytes: 0,
        egressBytes: 0,
        apiCallsCount: 0,
      };
      this.tenantUsage.set(tenantId, current);
    }

    if (usage.computeMs) current.computeMs += usage.computeMs;
    if (usage.memoryMb && usage.durationMs) current.memoryMbMs += usage.memoryMb * usage.durationMs;
    if (usage.storageBytes) current.storageBytes = Math.max(current.storageBytes, usage.storageBytes);
    if (usage.egressBytes) current.egressBytes += usage.egressBytes;
    if (usage.apiCalls) current.apiCallsCount += usage.apiCalls;
  }

  public generateInvoice(tenantId: string, periodDays: number = 30): TenantInvoice {
    const usage = this.tenantUsage.get(tenantId) || {
      tenantId,
      computeMs: 0,
      memoryMbMs: 0,
      storageBytes: 0,
      egressBytes: 0,
      apiCallsCount: 0,
    };

    const computeSec = usage.computeMs / 1000;
    const computeCost = computeSec * this.rates.computeSecPrice;

    const gbHours = usage.memoryMbMs / (1024 * 1000 * 3600);
    const memoryCost = gbHours * this.rates.memoryGbHourPrice;

    const storageGb = usage.storageBytes / (1024 * 1024 * 1024);
    const storageCost = storageGb * (this.rates.storageGbMonthPrice * (periodDays / 30));

    const egressGb = usage.egressBytes / (1024 * 1024 * 1024);
    const networkCost = egressGb * this.rates.networkEgressGbPrice;

    const apiCallCost = (usage.apiCallsCount / 1000) * this.rates.apiCallPricePerThousand;

    const totalCost = computeCost + memoryCost + storageCost + networkCost + apiCallCost;

    return {
      tenantId,
      periodStartTs: Date.now() - periodDays * 86400000,
      periodEndTs: Date.now(),
      computeCost,
      memoryCost,
      storageCost,
      networkCost,
      apiCallCost,
      totalCost,
    };
  }

  public resetPeriod(tenantId: string): void {
    this.tenantUsage.delete(tenantId);
  }
}
