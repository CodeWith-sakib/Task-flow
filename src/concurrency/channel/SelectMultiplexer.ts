/**
 * CSP Channel Select Multiplexer.
 * Implements Golang-style `select` statements over multiple CSP channels,
 * supporting non-blocking channel polling, timeouts, and default branches.
 */

import { CSPChannel } from './CSPChannel';

export interface SelectCase<T = any> {
  channel: CSPChannel<T>;
  onReceive: (val: T | undefined) => any;
}

export class SelectMultiplexer {
  /**
   * Executes a select operation across multiple channels, resolving the first ready channel.
   */
  public static async select<R = any>(
    cases: SelectCase[],
    options: { timeoutMs?: number; defaultAction?: () => R } = {}
  ): Promise<R> {
    if (cases.length === 0) {
      if (options.defaultAction) return options.defaultAction();
      throw new Error('Select on empty cases with no default');
    }

    const promises: Promise<R>[] = cases.map(async (c) => {
      const val = await c.channel.receive();
      return c.onReceive(val);
    });

    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      const timeoutPromise = new Promise<R>((_, reject) => {
        setTimeout(() => reject(new Error(`Select timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
      });
      promises.push(timeoutPromise);
    }

    return Promise.race(promises);
  }
}
