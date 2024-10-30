export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface FieldRule {
  type: SchemaFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export interface SchemaDefinition {
  fields: Record<string, FieldRule>;
}

export class SchemaValidator {
  static validate(data: Record<string, any>, schema: SchemaDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(schema.fields)) {
      const val = data[field];

      if (val === undefined || val === null) {
        if (rule.required) {
          errors.push(`Field '${field}' is required`);
        }
        continue;
      }

      const actualType = Array.isArray(val) ? 'array' : typeof val;
      if (actualType !== rule.type) {
        errors.push(`Field '${field}' expected type '${rule.type}' but got '${actualType}'`);
        continue;
      }

      if (rule.type === 'string') {
        if (rule.min !== undefined && val.length < rule.min) {
          errors.push(`Field '${field}' length must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && val.length > rule.max) {
          errors.push(`Field '${field}' length must not exceed ${rule.max}`);
        }
        if (rule.pattern && !rule.pattern.test(val)) {
          errors.push(`Field '${field}' does not match required format`);
        }
      }

      if (rule.type === 'number') {
        if (rule.min !== undefined && val < rule.min) {
          errors.push(`Field '${field}' must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && val > rule.max) {
          errors.push(`Field '${field}' must not exceed ${rule.max}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
