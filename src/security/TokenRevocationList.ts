export class TokenRevocationList {
  private revoked: Set<string> = new Set();

  public revoke(token: string): void {
    this.revoked.add(token);
  }

  public isRevoked(token: string): boolean {
    return this.revoked.has(token);
  }

  public clear(): void {
    this.revoked.clear();
  }
}
