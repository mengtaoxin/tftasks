import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from '../errors.ts';
import { migrations } from './migrations.ts';
import { migrate } from './migrate.ts';

const DATABASE_FILE = 'tftasks.db';

export function openDatabase(dataDir: string): DatabaseSync {
  const filePath = path.join(dataDir, DATABASE_FILE);
  if (!existsSync(filePath)) {
    throw new AppError('Not initialized. Run tftasks init.');
  }
  return connect(filePath);
}

export function createDatabase(dataDir: string): DatabaseSync {
  return connect(path.join(dataDir, DATABASE_FILE));
}

function connect(filePath: string): DatabaseSync {
  const db = new DatabaseSync(filePath, { enableForeignKeyConstraints: true });
  try {
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db, migrations);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}
