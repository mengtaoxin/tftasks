import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../cli.ts';

function jsonError(error: string) {
  return {
    exitCode: 1,
    stderr: '',
    stdout: `${JSON.stringify({ success: false, error }, null, 2)}\n`,
  };
}

describe('backup:create', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
    const absent = path.join(tmpdir(), `tftasks-backup-absent-${randomUUID()}`);
    process.env.TFTASKS_HOME = absent;
    cleanup.push(absent);
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

  async function initHome(): Promise<string> {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-backup-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;
    expect((await run(['init'])).exitCode).toBe(0);
    return dataDir;
  }

  it('returns the not-initialized error and does not create the data directory', async () => {
    const dataDir = process.env.TFTASKS_HOME;
    if (dataDir === undefined) {
      throw new Error('TFTASKS_HOME should be set');
    }

    const result = await run(['backup:create']);

    expect(result).toEqual(jsonError('Not initialized. Run tftasks init.'));
    expect(existsSync(dataDir)).toBe(false);
  });

  it('rejects unexpected arguments', async () => {
    await initHome();

    const result = await run(['backup:create', 'extra']);

    expect(result).toEqual(jsonError('Unexpected argument: extra'));
  });

  it('writes a zip with the database and files, excluding logs, backups, and settings', async () => {
    const dataDir = await initHome();
    const detail = 'Backup me\n';
    const create = await run([
      'task:create',
      '--params',
      JSON.stringify({ name: 'Backed-up task', priority: 'medium', detail }),
    ]);
    expect(create.exitCode).toBe(0);
    const created: unknown = JSON.parse(create.stdout);
    if (
      typeof created !== 'object' ||
      created === null ||
      !('task' in created) ||
      typeof created.task !== 'object' ||
      created.task === null ||
      !('id' in created.task) ||
      typeof created.task.id !== 'string'
    ) {
      throw new Error('Expected a created task');
    }
    const taskId = created.task.id;
    const attachmentRel = path.posix.join('files', 'task-attachments', taskId, 'index.md');

    await writeFile(path.join(dataDir, 'logs', 'noise.log'), 'should not be in zip\n');
    await writeFile(path.join(dataDir, 'backups', 'old.zip'), 'old\n');

    const before = Date.now();
    const result = await run(['backup:create']);
    const after = Date.now();

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const body: unknown = JSON.parse(result.stdout);
    expect(body).toEqual({
      success: true,
      path: expect.stringMatching(
        new RegExp(
          `^${escapeRegExp(path.join(dataDir, 'backups'))}[/\\\\]tftasks-backup-\\d{8}-\\d{6}\\.zip$`,
        ),
      ),
    });
    if (
      typeof body !== 'object' ||
      body === null ||
      !('path' in body) ||
      typeof body.path !== 'string'
    ) {
      throw new Error('Expected backup path');
    }
    const zipPath = body.path;
    expect(path.isAbsolute(zipPath)).toBe(true);
    expect(existsSync(zipPath)).toBe(true);

    const stamp = path.basename(zipPath, '.zip');
    const stampMatch = /^tftasks-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(stamp);
    expect(stampMatch).not.toBeNull();
    if (stampMatch === null) {
      throw new Error('expected tftasks-backup timestamp filename');
    }
    const localStamp = new Date(
      Number(stampMatch[1]),
      Number(stampMatch[2]) - 1,
      Number(stampMatch[3]),
      Number(stampMatch[4]),
      Number(stampMatch[5]),
      Number(stampMatch[6]),
    );
    expect(localStamp.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(localStamp.getTime()).toBeLessThanOrEqual(after + 1000);

    const entries = unzipSync(new Uint8Array(await readFile(zipPath)));
    const names = Object.keys(entries).toSorted();
    expect(names).toContain('tftasks.db');
    expect(names).toContain(attachmentRel);
    expect(names.some((name) => name.startsWith('logs/'))).toBe(false);
    expect(names.some((name) => name.startsWith('backups/'))).toBe(false);
    expect(names).not.toContain('settings.json');

    const detailBytes = entries[attachmentRel];
    if (detailBytes === undefined) {
      throw new Error('expected attachment in zip');
    }
    expect(new TextDecoder().decode(detailBytes)).toBe(detail);

    const leftovers = await readdir(path.join(dataDir, 'backups'));
    expect(
      leftovers.filter((name) => name !== path.basename(zipPath) && name !== 'old.zip'),
    ).toEqual([]);
  });
});

describe('help listing', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
    const absent = path.join(tmpdir(), `tftasks-help-absent-${randomUUID()}`);
    process.env.TFTASKS_HOME = absent;
    cleanup.push(absent);
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

  it('lists registered commands with column width for long names', async () => {
    const result = await run(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    for (const name of [
      'init',
      'backup:create',
      'task:create',
      'task:list',
      'repeat-task-config:create',
      'repeat-task-config:list',
    ]) {
      expect(result.stdout).toContain(name);
    }

    const line = result.stdout.split('\n').find((row) => row.includes('repeat-task-config:create'));
    expect(line).toBeDefined();
    if (line === undefined) {
      throw new Error('expected repeat-task-config:create line');
    }
    expect(line).toMatch(/^ {2}repeat-task-config:create {2,}Create a repeat task config$/);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
