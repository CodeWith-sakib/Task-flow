export class TaskCancellationCoordinator {
  private cancelledTokens: Set<string> = new Set();
  private callbacks: Map<string, Array<() => void>> = new Map();

  public cancel(tokenId: string): void {
    this.cancelledTokens.add(tokenId);
    const list = this.callbacks.get(tokenId);
    if (list) {
      list.forEach(cb => cb());
      this.callbacks.delete(tokenId);
    }
  }

  public isCancelled(tokenId: string): boolean {
    return this.cancelledTokens.has(tokenId);
  }

  public onCancelled(tokenId: string, callback: () => void): void {
    if (this.isCancelled(tokenId)) {
      callback();
      return;
    }
    let list = this.callbacks.get(tokenId);
    if (!list) {
      list = [];
      this.callbacks.set(tokenId, list);
    }
    list.push(callback);
  }
}
