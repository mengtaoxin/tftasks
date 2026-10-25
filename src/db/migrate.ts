import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Migration } from './migrations.ts';

const SCHEMA_MIGRATIONS = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT`;

export function migrate(db: DatabaseSync, steps: readonly Migration[]): void {
  db.exec(SCHEMA_MIGRATIONS);

  for (const step of steps) {
    const digest = sha256(step.sql);
    const stored = readChecksum(db, step.version);
    if (stored === undefined) {
      applyMigration(db, step, digest);
      continue;
    }
    if (stored !== digest) {
      throw checksumMismatch(step.version);
    }
  }
}

function applyMigration(db: DatabaseSync, step: Migration, digest: string): void {
  db.exec('BEGIN');
  try {
    db.exec(step.sql);
    db.prepare(
      `INSERT INTO schema_migrations (version, name, checksum, applied_at)
       VALUES (?, ?, ?, ?)`,
    ).run(step.version, step.name, digest, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) {
      db.exec('ROLLBACK');
    }
    throw error;
  }
}

function readChecksum(db: DatabaseSync, version: number): string | undefined {
  const row = db.prepare('SELECT checksum FROM schema_migrations WHERE version = ?').get(version);
  if (row === undefined) {
    return undefined;
  }
  if (typeof row.checksum !== 'string') {
    throw checksumMismatch(version);
  }
  return row.checksum;
}

function sha256(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function checksumMismatch(version: number): Error {
  return new Error(`Migration checksum mismatch for version ${version}.`);
}
