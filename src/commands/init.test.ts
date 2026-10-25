import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../cli.ts';
import { migrations } from '../db/migrations.ts';

describe('init', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
  });

  afterEach(() => {
    if (previousHome === undefined) {
      delete process.env.TFTASKS_HOME;
    } else {
      process.env.TFTASKS_HOME = previousHome;
    }
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  function useDataDir(dataDir: string): void {
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;
  }

  it('creates the database, settings, and directories', async () => {
    const dataDir = path.join(tmpdir(), `tftasks-init-${randomUUID()}`);
    useDataDir(dataDir);

    const result = await run(['init']);

    expect(result).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: `${JSON.stringify({ success: true, dataDir }, null, 2)}\n`,
    });
    expect(existsSync(path.join(dataDir, 'tftasks.db'))).toBe(true);
    for (const name of ['logs', 'backups', 'files']) {
      expect(statSync(path.join(dataDir, name)).isDirectory()).toBe(true);
    }
    expect(JSON.parse(await readFile(path.join(dataDir, 'settings.json'), 'utf8'))).toEqual({
      version: 1,
    });

    const db = new DatabaseSync(path.join(dataDir, 'tftasks.db'));
    try {
      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
        )
        .all();
      expect(tables).toEqual([
        { name: 'repeat_task_configs' },
        { name: 'schema_migrations' },
        { name: 'tasks' },
      ]);
    } finally {
      db.close();
    }
  });

  it('succeeds again without overwriting settings or recording the migration twice', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-init-'));
    useDataDir(dataDir);
    expect((await run(['init'])).exitCode).toBe(0);

    const settingsPath = path.join(dataDir, 'settings.json');
    const custom = '{"version":9,"keep":true}\n';
    await writeFile(settingsPath, custom);

    const second = await run(['init']);

    expect(second).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: `${JSON.stringify({ success: true, dataDir }, null, 2)}\n`,
    });
    expect(await readFile(settingsPath, 'utf8')).toBe(custom);

    const db = new DatabaseSync(path.join(dataDir, 'tftasks.db'));
    try {
      expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toEqual({
        count: migrations.length,
      });
    } finally {
      db.close();
    }
  });

  it('rejects extra arguments without creating the data directory', async () => {
    const dataDir = path.join(tmpdir(), `tftasks-init-${randomUUID()}`);
    useDataDir(dataDir);

    const result = await run(['init', 'extra']);

    expect(result).toEqual({
      exitCode: 1,
      stderr: '',
      stdout: `${JSON.stringify({ success: false, error: 'Unexpected argument: extra' }, null, 2)}\n`,
    });
    expect(existsSync(dataDir)).toBe(false);
  });

  it('lists init in help', async () => {
    const dataDir = path.join(tmpdir(), `tftasks-init-absent-${randomUUID()}`);
    useDataDir(dataDir);

    const result = await run(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('Create the local data directory');
    expect(existsSync(dataDir)).toBe(false);
  });
});
