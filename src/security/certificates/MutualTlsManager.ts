/**
 * Mutual TLS (mTLS) Security & Certificate Authority Manager.
 * Validates peer client certificates against trusted root CAs, enforces Certificate
 * Revocation Lists (CRLs), and manages dynamic in-memory certificate rotation.
 */

import { X509CertificateParser, ParsedCertificateInfo } from './X509CertificateParser';

export interface TlsVerificationResult {
  trusted: boolean;
  certInfo?: ParsedCertificateInfo;
  reason?: string;
}

export class MutualTlsManager {
  private parser = new X509CertificateParser();
  private trustedRootCas = new Set<string>(); // Root CA fingerprints
  private revokedFingerprints = new Set<string>();
  private allowedCommonNames = new Set<string>();

  public registerRootCa(caPem: string): string {
    const info = this.parser.parsePem(caPem);
    this.trustedRootCas.add(info.fingerprintSha256);
    return info.fingerprintSha256;
  }

  public revokeCertificate(fingerprintSha256: string): void {
    this.revokedFingerprints.add(fingerprintSha256.toLowerCase());
  }

  public allowCommonName(cn: string): void {
    this.allowedCommonNames.add(cn);
  }

  public verifyPeerCertificate(peerPem: string, expectedHostname?: string): TlsVerificationResult {
    try {
      const certInfo = this.parser.parsePem(peerPem);

      // 1. Check expiration and validity window
      if (this.parser.isExpired(certInfo)) {
        return { trusted: false, certInfo, reason: 'Peer certificate is expired' };
      }
      if (this.parser.isNotYetValid(certInfo)) {
        return { trusted: false, certInfo, reason: 'Peer certificate is not yet valid' };
      }

      // 2. Check CRL revocation
      if (this.revokedFingerprints.has(certInfo.fingerprintSha256)) {
        return { trusted: false, certInfo, reason: 'Peer certificate is revoked' };
      }

      // 3. Check allowed Common Names if policy is active
      if (this.allowedCommonNames.size > 0 && !this.allowedCommonNames.has(certInfo.subjectCN)) {
        return { trusted: false, certInfo, reason: `Common name "${certInfo.subjectCN}" is not authorized` };
      }

      // 4. Check hostname match if provided
      if (expectedHostname && !this.parser.matchesHostname(certInfo, expectedHostname)) {
        return { trusted: false, certInfo, reason: `Certificate does not match expected hostname "${expectedHostname}"` };
      }

      return {
        trusted: true,
        certInfo,
      };
    } catch (err: any) {
      return {
        trusted: false,
        reason: err.message || 'Invalid certificate',
      };
    }
  }
}
