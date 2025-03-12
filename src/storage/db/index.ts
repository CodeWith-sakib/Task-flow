import { InMemoryDB } from './InMemoryDB';

export class DatabaseFactory {
  static createDatabase() {
    const dbType = process.env.DATABASE_TYPE || 'memory';

    if (dbType === 'memory') {
      return new InMemoryDB();
    }

    throw new Error(`Unsupported database type: ${dbType}`);
  }
}

export type Database = InMemoryDB;
