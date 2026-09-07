/**
 * X.509 Certificate Parser & Validator.
 * Extracts Subject Alternative Names (SANs), Common Names (CN), issuer chains,
 * cryptographic key fingerprints (SHA-256), and checks validity windows.
 */

import * as crypto from 'crypto';

export interface ParsedCertificateInfo {
  subjectCN: string;
  issuerCN: string;
  sans: string[];
  fingerprintSha256: string;
  validFrom: number;
  validTo: number;
  isSelfSigned: boolean;
}

export class X509CertificateParser {
  public parsePem(pem: string): ParsedCertificateInfo {
    try {
      const x509 = new crypto.X509Certificate(pem);

      // Extract subject CN
      const subject = x509.subject;
      const cnMatch = subject.match(/CN=([^,\n]+)/);
      const subjectCN = cnMatch ? cnMatch[1] : '';

      // Extract issuer CN
      const issuer = x509.issuer;
      const issuerCnMatch = issuer.match(/CN=([^,\n]+)/);
      const issuerCN = issuerCnMatch ? issuerCnMatch[1] : '';

      // Extract SANs
      const sans: string[] = [];
      const sanStr = x509.subjectAltName;
      if (sanStr) {
        const parts = sanStr.split(', ');
        for (const p of parts) {
          const item = p.replace(/^(DNS:|IP Address:|URI:)/, '');
          sans.push(item);
        }
      }

      const validFrom = new Date(x509.validFrom).getTime();
      const validTo = new Date(x509.validTo).getTime();
      const fingerprintSha256 = x509.fingerprint256.replace(/:/g, '').toLowerCase();

      const isSelfSigned = subject === issuer;

      return {
        subjectCN,
        issuerCN,
        sans,
        fingerprintSha256,
        validFrom,
        validTo,
        isSelfSigned,
      };
    } catch (err: any) {
      throw new Error(`Failed to parse X.509 certificate: ${err.message || String(err)}`);
    }
  }

  public isExpired(certInfo: ParsedCertificateInfo, now: number = Date.now()): boolean {
    return now > certInfo.validTo;
  }

  public isNotYetValid(certInfo: ParsedCertificateInfo, now: number = Date.now()): boolean {
    return now < certInfo.validFrom;
  }

  public matchesHostname(certInfo: ParsedCertificateInfo, hostname: string): boolean {
    if (certInfo.subjectCN === hostname) return true;
    for (const san of certInfo.sans) {
      if (san === hostname) return true;
      if (san.startsWith('*.') && hostname.endsWith(san.substring(1))) {
        return true;
      }
    }
    return false;
  }
}
