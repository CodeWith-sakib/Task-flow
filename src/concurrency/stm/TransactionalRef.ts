/**
 * Software Transactional Memory: Transactional Reference (TVar).
 * Represents a mutable reference cell managed under STM transaction scopes.
 */

export class TransactionalRef<T> {
  private value: T;
  private version: number = 0;

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  public getRawValue(): T {
    return this.value;
  }

  public getVersion(): number {
    return this.version;
  }

  public setRawValue(val: T, version: number): void {
    this.value = val;
    this.version = version;
  }
}
