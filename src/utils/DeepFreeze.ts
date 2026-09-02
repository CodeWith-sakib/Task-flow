export class DeepFreeze {
  public static freeze<T>(obj: T): Readonly<T> {
    if (obj && typeof obj === 'object') {
      Object.freeze(obj);
      for (const key of Object.keys(obj)) {
        const val = (obj as any)[key];
        if (val && typeof val === 'object' && !Object.isFrozen(val)) {
          this.freeze(val);
        }
      }
    }
    return obj;
  }
}
