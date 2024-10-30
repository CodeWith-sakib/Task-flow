import { SchemaValidator } from '../../src/security/validation/SchemaValidator';

describe('SchemaValidator Unit Tests', () => {
  it('should validate payloads according to strict schema rules', () => {
    const schema = {
      fields: {
        taskName: { type: 'string' as const, required: true, min: 3 },
        retries: { type: 'number' as const, min: 0, max: 10 },
      },
    };

    const valid = SchemaValidator.validate({ taskName: 'compute', retries: 3 }, schema);
    expect(valid.valid).toBe(true);

    const invalid = SchemaValidator.validate({ taskName: 'co', retries: -1 }, schema);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBe(2);
  });
});
