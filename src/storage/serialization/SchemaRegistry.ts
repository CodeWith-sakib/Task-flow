import * as crypto from 'crypto';

export type CompatibilityMode = 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE';

export interface SchemaDefinition {
  subject: string;
  version: number;
  id: number;
  schema: Record<string, any>;
  fingerprint: string;
}

/**
 * SchemaRegistry manages schema evolution and compatibility rules (BACKWARD, FORWARD, FULL)
 * for event-driven payloads and message queues.
 */
export class SchemaRegistry {
  private schemas: Map<string, SchemaDefinition[]> = new Map(); // subject -> versions
  private idToSchema: Map<number, SchemaDefinition> = new Map();
  private nextId: number = 1;
  private compatibilityMode: CompatibilityMode;

  constructor(compatibilityMode: CompatibilityMode = 'BACKWARD') {
    this.compatibilityMode = compatibilityMode;
  }

  public registerSchema(subject: string, schema: Record<string, any>): SchemaDefinition {
    const fingerprint = this.computeFingerprint(schema);
    const existingList = this.schemas.get(subject) || [];

    // Check if identical schema already exists
    const existing = existingList.find(s => s.fingerprint === fingerprint);
    if (existing) {
      return existing;
    }

    if (existingList.length > 0 && this.compatibilityMode !== 'NONE') {
      const latest = existingList[existingList.length - 1];
      this.checkCompatibility(latest.schema, schema, this.compatibilityMode);
    }

    const version = existingList.length + 1;
    const id = this.nextId++;

    const definition: SchemaDefinition = {
      subject,
      version,
      id,
      schema,
      fingerprint
    };

    existingList.push(definition);
    this.schemas.set(subject, existingList);
    this.idToSchema.set(id, definition);

    return definition;
  }

  public getSchemaById(id: number): SchemaDefinition | undefined {
    return this.idToSchema.get(id);
  }

  public getLatestSchema(subject: string): SchemaDefinition | undefined {
    const list = this.schemas.get(subject);
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }

  private checkCompatibility(oldSchema: Record<string, any>, newSchema: Record<string, any>, mode: CompatibilityMode): void {
    const oldProps = Object.keys(oldSchema.properties || {});
    const newProps = Object.keys(newSchema.properties || {});
    const requiredInNew = newSchema.required || [];

    if (mode === 'BACKWARD' || mode === 'FULL') {
      // BACKWARD: New schema must be able to read data written by old schema.
      // Newly added fields must have a default value or not be required.
      for (const field of requiredInNew) {
        if (!oldProps.includes(field)) {
          throw new Error(`Incompatible schema change (BACKWARD): required field '${field}' added without default`);
        }
      }
    }

    if (mode === 'FORWARD' || mode === 'FULL') {
      // FORWARD: Old schema can read data written by new schema.
      // Deleted fields must not have been required in old schema.
      const oldRequired = oldSchema.required || [];
      for (const req of oldRequired) {
        if (!newProps.includes(req)) {
          throw new Error(`Incompatible schema change (FORWARD): previously required field '${req}' removed`);
        }
      }
    }
  }

  private computeFingerprint(schema: Record<string, any>): string {
    const canonical = JSON.stringify(schema, Object.keys(schema).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }
}
