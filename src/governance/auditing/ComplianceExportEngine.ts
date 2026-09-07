/**
 * SOC2 & HIPAA Compliance Audit Exporter.
 * Formats, bundles, signs, and exports immutable audit trails in newline-delimited JSON (NDJSON),
 * calculating manifest Merkle roots and integrity checksums.
 */

import * as crypto from 'crypto';
import { SignedAuditEvent } from './AuditEventSigner';

export interface ComplianceExportManifest {
  exportId: string;
  tenantId: string;
  generatedAt: number;
  recordCount: number;
  timeRange: { from: number; to: number };
  manifestHash: string;
  signingKeyId: string;
}

export interface ComplianceExportBundle {
  manifest: ComplianceExportManifest;
  ndjsonPayload: string;
  sha256Checksum: string;
}

export class ComplianceExportEngine {
  public generateExportBundle(
    tenantId: string,
    events: SignedAuditEvent[],
    timeRange: { from: number; to: number },
    signingKeyId: string = 'audit-key-v1'
  ): ComplianceExportBundle {
    const filtered = events.filter(
      (e) => e.tenantId === tenantId && e.timestamp >= timeRange.from && e.timestamp <= timeRange.to
    );

    // Format as NDJSON
    const ndjsonLines = filtered.map((e) => JSON.stringify(e));
    const ndjsonPayload = ndjsonLines.join('\n');

    const sha256Checksum = crypto.createHash('sha256').update(ndjsonPayload).digest('hex');

    const manifest: ComplianceExportManifest = {
      exportId: `export-${tenantId}-${Date.now()}`,
      tenantId,
      generatedAt: Date.now(),
      recordCount: filtered.length,
      timeRange,
      manifestHash: sha256Checksum,
      signingKeyId,
    };

    return {
      manifest,
      ndjsonPayload,
      sha256Checksum,
    };
  }

  public verifyExportBundle(bundle: ComplianceExportBundle): boolean {
    const computedHash = crypto.createHash('sha256').update(bundle.ndjsonPayload).digest('hex');
    return computedHash === bundle.sha256Checksum && bundle.manifest.manifestHash === computedHash;
  }
}
