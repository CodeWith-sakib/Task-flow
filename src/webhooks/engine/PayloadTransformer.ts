export interface TransformationRule {
  targetKey: string;
  sourcePath?: string;
  template?: string;
  defaultValue?: any;
  transformFn?: (val: any) => any;
}

/**
 * PayloadTransformer shapes and sanitizes outbound webhook JSON payloads
 * to conform to destination endpoint schemas.
 */
export class PayloadTransformer {
  private rules: TransformationRule[];

  constructor(rules: TransformationRule[]) {
    this.rules = rules;
  }

  public transform(sourcePayload: Record<string, any>): Record<string, any> {
    const output: Record<string, any> = {};

    for (const rule of this.rules) {
      if (rule.sourcePath) {
        const raw = this.resolvePath(sourcePayload, rule.sourcePath);
        const value = raw !== undefined ? raw : rule.defaultValue;
        output[rule.targetKey] = rule.transformFn ? rule.transformFn(value) : value;
      } else if (rule.template) {
        output[rule.targetKey] = this.renderTemplate(rule.template, sourcePayload);
      } else if (rule.defaultValue !== undefined) {
        output[rule.targetKey] = rule.defaultValue;
      }
    }

    return output;
  }

  private resolvePath(target: any, path: string): any {
    if (!target || !path) return undefined;
    const parts = path.split('.');
    let current = target;
    for (const p of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[p];
    }
    return current;
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const val = this.resolvePath(data, key.trim());
      return val !== undefined && val !== null ? String(val) : '';
    });
  }
}
