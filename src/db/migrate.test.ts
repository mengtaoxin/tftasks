import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../errors.ts';
import { migrations } from './migrations.ts';
import { migrate } from './migrate.ts';
import { createDatabase, openDatabase } from './open.ts';

const dirs: string[] = [];

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tftasks-db-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  dirs.length = 0;
});

function sha256(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function withMemory(run: (db: DatabaseSync) => void): void {
  const db = new DatabaseSync(':memory:');
  try {
    run(db);
  } finally {
    db.close();
  }
}

function columnNames(
  db: DatabaseSync,
  table: 'schema_migrations' | 'repeat_task_configs' | 'tasks',
): string[] {
  const sql = {
    schema_migrations: 'PRAGMA table_info(schema_migrations)',
    repeat_task_configs: 'PRAGMA table_info(repeat_task_configs)',
    tasks: 'PRAGMA table_info(tasks)',
  }[table];
  return db
    .prepare(sql)
    .all()
    .map((row) => {
      if (typeof row.name !== 'string') {
        throw new Error(`Expected a column name for ${table}.`);
      }
      return row.name;
    });
}

describe('migrate', () => {
  it('records a migration once and stores a sha256 checksum', () => {
    const step = {
      version: 1,
      name: 'alpha',
      sql: 'CREATE TABLE alpha (id INTEGER PRIMARY KEY);',
    };

    withMemory((db) => {
      migrate(db, [step]);
      migrate(db, [step]);

      expect(columnNames(db, 'schema_migrations')).toEqual([
        'version',
        'name',
        'checksum',
        'applied_at',
      ]);
      const rows = db
        .prepare('SELECT version, name, checksum, applied_at FROM schema_migrations')
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        version: 1,
        name: 'alpha',
        checksum: sha256(step.sql),
      });
      const appliedAt = rows[0]?.applied_at;
      expect(appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  it('rejects a checksum mismatch and does not apply later migrations', () => {
    const step = {
      version: 1,
      name: 'alpha',
      sql: 'CREATE TABLE alpha (id INTEGER PRIMARY KEY);',
    };
    const changed = {
      ...step,
      sql: 'CREATE TABLE alpha (id INTEGER PRIMARY KEY, name TEXT);',
    };
    const next = {
      version: 2,
      name: 'beta',
      sql: 'CREATE TABLE beta (id INTEGER PRIMARY KEY);',
    };

    withMemory((db) => {
      migrate(db, [step]);

      expect(() => migrate(db, [changed, next])).toThrow(
        'Migration checksum mismatch for version 1.',
      );

      const versions = db.prepare('SELECT version, checksum FROM schema_migrations').all();
      expect(versions).toEqual([{ version: 1, checksum: sha256(step.sql) }]);
      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('alpha', 'beta') ORDER BY name`,
        )
        .all();
      expect(tables).toEqual([{ name: 'alpha' }]);
    });
  });

  it('rolls back a migration that fails before recording it', () => {
    const step = {
      version: 1,
      name: 'bad',
      sql: `CREATE TABLE rolled (id INTEGER PRIMARY KEY);
INSERT INTO rolled (id) VALUES (1);
INSERT INTO rolled (id) VALUES (1);`,
    };

    withMemory((db) => {
      expect(() => migrate(db, [step])).toThrow();
      expect(columnNames(db, 'schema_migrations')).toEqual([
        'version',
        'name',
        'checksum',
        'applied_at',
      ]);
      expect(db.prepare('SELECT version FROM schema_migrations').all()).toEqual([]);
      const rolled = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rolled'`)
        .all();
      expect(rolled).toEqual([]);
    });
  });

  it('creates the task tables, checks, indexes, and set-null foreign key from version 1', () => {
    withMemory((db) => {
      db.exec('PRAGMA foreign_keys = ON');
      migrate(db, migrations);

      expect(columnNames(db, 'repeat_task_configs')).toEqual([
        'id',
        'name',
        'priority',
        'period',
        'interval',
        'times_per_period',
        'enabled',
        'created_at',
        'updated_at',
      ]);
      expect(columnNames(db, 'tasks')).toEqual([
        'id',
        'name',
        'status',
        'parent_id',
        'priority',
        'repeat_task_config_id',
        'completed_at',
        'created_at',
        'updated_at',
        'starts_at',
        'ends_at',
      ]);
      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'index' AND tbl_name = 'tasks' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all();
      expect(indexes).toEqual([
        { name: 'tasks_parent_id_idx' },
        { name: 'tasks_repeat_task_config_id_idx' },
        { name: 'tasks_status_idx' },
      ]);

      const insertConfig = db.prepare(
        `INSERT INTO repeat_task_configs
           (id, name, priority, period, interval, times_per_period, enabled, created_at, updated_at)
         VALUES (?, ?, 'high', 'day', ?, ?, ?, '2026-10-25T00:00:00.000Z', '2026-10-25T00:00:00.000Z')`,
      );
      expect(() => insertConfig.run('bad-interval', 'Daily', 0, 1, 1)).toThrow();

      const insertBadPeriod = db.prepare(
        `INSERT INTO repeat_task_configs
           (id, name, priority, period, interval, times_per_period, enabled, created_at, updated_at)
         VALUES ('bad-period', 'Daily', 'high', 'hour', 1, 1, 1, '2026-10-25T00:00:00.000Z', '2026-10-25T00:00:00.000Z')`,
      );
      expect(() => insertBadPeriod.run()).toThrow();

      const insertBadEnabled = db.prepare(
        `INSERT INTO repeat_task_configs
           (id, name, priority, period, interval, times_per_period, enabled, created_at, updated_at)
         VALUES ('bad-enabled', 'Daily', 'high', 'day', 1, 1, 2, '2026-10-25T00:00:00.000Z', '2026-10-25T00:00:00.000Z')`,
      );
      expect(() => insertBadEnabled.run()).toThrow();

      insertConfig.run('c1', 'Daily', 1, 1, 1);
      const insertTask = db.prepare(
        `INSERT INTO tasks
           (id, name, status, parent_id, priority, repeat_task_config_id, completed_at, created_at, updated_at)
         VALUES (?, 'Do', ?, NULL, 'low', ?, NULL, '2026-10-25T00:00:00.000Z', '2026-10-25T00:00:00.000Z')`,
      );
      expect(() => insertTask.run('bad-status', 'done', 'c1')).toThrow();
      insertTask.run('t1', 'incomplete', 'c1');

      expect(db.prepare('SELECT starts_at, ends_at FROM tasks WHERE id = ?').get('t1')).toEqual({
        starts_at: null,
        ends_at: null,
      });

      db.prepare(`DELETE FROM repeat_task_configs WHERE id = ?`).run('c1');
      expect(db.prepare('SELECT repeat_task_config_id FROM tasks WHERE id = ?').get('t1')).toEqual({
        repeat_task_config_id: null,
      });
    });
  });
});

describe('task date columns', () => {
  it('adds nullable start and end dates when upgrading a version 1 database', () => {
    withMemory((db) => {
      const initial = migrations[0];
      migrate(db, [initial]);
      expect(columnNames(db, 'tasks')).not.toContain('starts_at');
      expect(columnNames(db, 'tasks')).not.toContain('ends_at');
      db.prepare(
        `INSERT INTO tasks
           (id, name, status, parent_id, priority, repeat_task_config_id, completed_at, created_at, updated_at)
         VALUES ('t1', 'Do', 'incomplete', NULL, 'low', NULL, NULL, '2026-10-25T00:00:00.000Z', '2026-10-25T00:00:00.000Z')`,
      ).run();

      migrate(db, migrations);

      expect(columnNames(db, 'tasks')).toEqual([
        'id',
        'name',
        'status',
        'parent_id',
        'priority',
        'repeat_task_config_id',
        'completed_at',
        'created_at',
        'updated_at',
        'starts_at',
        'ends_at',
      ]);
      expect(db.prepare('SELECT starts_at, ends_at FROM tasks WHERE id = ?').get('t1')).toEqual({
        starts_at: null,
        ends_at: null,
      });
      expect(db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([
        { version: 1 },
        { version: 2 },
      ]);
    });
  });
});

describe('openDatabase', () => {
  it('throws when tftasks.db does not exist and does not create it', () => {
    const dataDir = path.join(tmpdir(), `tftasks-missing-${randomUUID()}`);
    dirs.push(dataDir);

    expect(() => openDatabase(dataDir)).toThrow(AppError);
    expect(() => openDatabase(dataDir)).toThrow('Not initialized. Run tftasks init.');
    expect(existsSync(dataDir)).toBe(false);
    expect(existsSync(path.join(dataDir, 'tftasks.db'))).toBe(false);
  });

  it('creates the database, enables foreign keys, and migrates only once', () => {
    const dataDir = makeDir();
    const filePath = path.join(dataDir, 'tftasks.db');

    const created = createDatabase(dataDir);
    created.close();
    expect(existsSync(filePath)).toBe(true);

    const opened = openDatabase(dataDir);
    try {
      expect(opened.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
      expect(opened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
        count: migrations.length,
      });
    } finally {
      opened.close();
    }

    const again = createDatabase(dataDir);
    try {
      expect(again.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
        count: migrations.length,
      });
    } finally {
      again.close();
    }
  });

  it('refuses to open when an applied migration checksum does not match', () => {
    const dataDir = makeDir();
    const created = createDatabase(dataDir);
    created
      .prepare('UPDATE schema_migrations SET checksum = ? WHERE version = ?')
      .run('tampered', 1);
    created.close();

    expect(() => openDatabase(dataDir)).toThrow('Migration checksum mismatch for version 1.');

    const inspect = new DatabaseSync(path.join(dataDir, 'tftasks.db'));
    try {
      expect(inspect.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
        count: migrations.length,
      });
      expect(
        inspect
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'`)
          .all(),
      ).toEqual([{ name: 'tasks' }]);
    } finally {
      inspect.close();
    }
  });
});
