import * as crypto from 'crypto';

export interface Caveat {
  predicate: string;
}

export interface SerializedMacaroon {
  location: string;
  identifier: string;
  signature: string;
  caveats: Caveat[];
}

/**
 * MacaroonManager implements Macaroon authorization tokens with chained HMAC-SHA256
 * cryptographic attenuation for decentralized, context-sensitive delegation.
 */
export class MacaroonManager {
  private rootKey: Buffer;
  private location: string;

  constructor(rootSecret: string | Buffer, location: string = 'taskflow-engine') {
    if (typeof rootSecret === 'string') {
      this.rootKey = crypto.createHash('sha256').update(rootSecret).digest();
    } else {
      this.rootKey = rootSecret;
    }
    this.location = location;
  }

  public create(identifier: string): SerializedMacaroon {
    const signature = this.computeHmac(this.rootKey, identifier).toString('hex');
    return {
      location: this.location,
      identifier,
      signature,
      caveats: []
    };
  }

  public addFirstPartyCaveat(macaroon: SerializedMacaroon, predicate: string): SerializedMacaroon {
    const currentSig = Buffer.from(macaroon.signature, 'hex');
    const newSig = this.computeHmac(currentSig, predicate).toString('hex');

    return {
      ...macaroon,
      signature: newSig,
      caveats: [...macaroon.caveats, { predicate }]
    };
  }

  public verify(
    macaroon: SerializedMacaroon,
    context: Record<string, any>,
    predicateEvaluator?: (predicate: string, ctx: Record<string, any>) => boolean
  ): boolean {
    let runningSig = this.computeHmac(this.rootKey, macaroon.identifier);

    for (const caveat of macaroon.caveats) {
      // 1. Verify caveat satisfies context
      const isValid = predicateEvaluator
        ? predicateEvaluator(caveat.predicate, context)
        : this.defaultPredicateEvaluator(caveat.predicate, context);

      if (!isValid) {
        return false;
      }

      // 2. Chained signature derivation
      runningSig = this.computeHmac(runningSig, caveat.predicate);
    }

    return runningSig.toString('hex') === macaroon.signature;
  }

  private defaultPredicateEvaluator(predicate: string, context: Record<string, any>): boolean {
    // Format: "key = value" or "key < value" or "key > value"
    const match = predicate.match(/^([a-zA-Z0-9_.-]+)\s*(=|<|>)\s*(.+)$/);
    if (!match) return false;

    const [, key, op, rawVal] = match;
    const ctxVal = context[key];
    if (ctxVal === undefined) return false;

    const targetVal = isNaN(Number(rawVal)) ? rawVal.trim() : Number(rawVal);

    if (op === '=') {
      return String(ctxVal) === String(targetVal);
    } else if (op === '<') {
      return Number(ctxVal) < Number(targetVal);
    } else if (op === '>') {
      return Number(ctxVal) > Number(targetVal);
    }

    return false;
  }

  private computeHmac(key: Buffer, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }
}
