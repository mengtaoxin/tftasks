import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../cli.ts';

type TaskJson = {
  id: string;
  name: string;
  status: string;
  parentId: string | null;
  priority: string;
  repeatTaskConfigId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  detail: string;
  detailPath: string;
};

type ConfigJson = {
  id: string;
  name: string;
  priority: string;
  period: string;
  interval: number;
  timesPerPeriod: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  detail: string;
  detailPath: string;
};

type Page = {
  items: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
};

type MixedFixture = {
  dataDir: string;
  inbox: TaskJson;
  child: TaskJson;
  done: TaskJson;
  daily: ConfigJson;
  off: ConfigJson;
  later: ConfigJson;
  spent: ConfigJson;
  generated: TaskJson;
};

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const INVALID_CREATE: ReadonlyArray<readonly [string, Record<string, unknown>, string]> = [
  [
    'name is missing',
    { priority: 'low', period: 'day', interval: 1, timesPerPeriod: 1, enabled: true },
    'Missing field: name.',
  ],
  [
    'priority is missing',
    { name: 'A', period: 'day', interval: 1, timesPerPeriod: 1, enabled: true },
    'Missing field: priority.',
  ],
  [
    'period is missing',
    { name: 'A', priority: 'low', interval: 1, timesPerPeriod: 1, enabled: true },
    'Missing field: period.',
  ],
  [
    'interval is missing',
    { name: 'A', priority: 'low', period: 'day', timesPerPeriod: 1, enabled: true },
    'Missing field: interval.',
  ],
  [
    'timesPerPeriod is missing',
    { name: 'A', priority: 'low', period: 'day', interval: 1, enabled: true },
    'Missing field: timesPerPeriod.',
  ],
  [
    'enabled is missing',
    { name: 'A', priority: 'low', period: 'day', interval: 1, timesPerPeriod: 1 },
    'Missing field: enabled.',
  ],
  [
    'name is empty',
    { name: '', priority: 'low', period: 'day', interval: 1, timesPerPeriod: 1, enabled: true },
    'Invalid name.',
  ],
  [
    'priority is unknown',
    {
      name: 'A',
      priority: 'urgent',
      period: 'day',
      interval: 1,
      timesPerPeriod: 1,
      enabled: true,
    },
    'Invalid priority.',
  ],
  [
    'period is unknown',
    { name: 'A', priority: 'low', period: 'hour', interval: 1, timesPerPeriod: 1, enabled: true },
    'Invalid period.',
  ],
  [
    'interval is zero',
    { name: 'A', priority: 'low', period: 'day', interval: 0, timesPerPeriod: 1, enabled: true },
    'Invalid interval.',
  ],
  [
    'interval is fractional',
    { name: 'A', priority: 'low', period: 'day', interval: 1.5, timesPerPeriod: 1, enabled: true },
    'Invalid interval.',
  ],
  [
    'timesPerPeriod is zero',
    { name: 'A', priority: 'low', period: 'day', interval: 1, timesPerPeriod: 0, enabled: true },
    'Invalid timesPerPeriod.',
  ],
  [
    'enabled is numeric',
    { name: 'A', priority: 'low', period: 'day', interval: 1, timesPerPeriod: 1, enabled: 1 },
    'Invalid enabled.',
  ],
  [
    'detail is not text',
    {
      name: 'A',
      priority: 'low',
      period: 'day',
      interval: 1,
      timesPerPeriod: 1,
      enabled: true,
      detail: 1,
    },
    'Invalid detail.',
  ],
  [
    'a field is unknown',
    {
      name: 'A',
      priority: 'low',
      period: 'day',
      interval: 1,
      timesPerPeriod: 1,
      enabled: true,
      status: 'incomplete',
    },
    'Unknown field: status.',
  ],
];

function jsonError(error: string) {
  return {
    exitCode: 1,
    stderr: '',
    stdout: `${JSON.stringify({ success: false, error }, null, 2)}\n`,
  };
}

function configBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Daily',
    priority: 'high',
    period: 'day',
    interval: 1,
    timesPerPeriod: 1,
    enabled: true,
    ...overrides,
  };
}

function parsedTask(stdout: string): TaskJson {
  const body: unknown = JSON.parse(stdout);
  if (!isTaskEnvelope(body)) {
    throw new Error('Expected a task envelope');
  }
  return body.task;
}

function parsedConfig(stdout: string): ConfigJson {
  const body: unknown = JSON.parse(stdout);
  if (!isConfigEnvelope(body)) {
    throw new Error('Expected a repeat task config envelope');
  }
  return body.config;
}

function parsedPage(stdout: string): Page {
  const body: unknown = JSON.parse(stdout);
  if (!isPage(body)) {
    throw new Error('Expected a list envelope');
  }
  return body;
}

async function createTask(body: Record<string, unknown>): Promise<TaskJson> {
  const result = await run(['task:create', '--params', JSON.stringify(body)]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedTask(result.stdout);
}

async function createConfig(body: Record<string, unknown>): Promise<ConfigJson> {
  const result = await run(['repeat-task-config:create', '--params', JSON.stringify(body)]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedConfig(result.stdout);
}

async function readConfig(id: string): Promise<ConfigJson> {
  const result = await run(['repeat-task-config:read', '--params', JSON.stringify({ id })]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedConfig(result.stdout);
}

async function updateConfig(body: Record<string, unknown>): Promise<ConfigJson> {
  const result = await run(['repeat-task-config:update', '--params', JSON.stringify(body)]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedConfig(result.stdout);
}

async function finishTask(id: string): Promise<TaskJson> {
  const result = await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id })]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedTask(result.stdout);
}

async function finishConfig(id: string): Promise<TaskJson> {
  const result = await run([
    'task:finish',
    '--params',
    JSON.stringify({ kind: 'repeat-task-config', id }),
  ]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedTask(result.stdout);
}

async function list(
  command: 'task:list' | 'repeat-task-config:list',
  params?: Record<string, unknown>,
): Promise<Page> {
  const args = params === undefined ? [command] : [command, '--params', JSON.stringify(params)];
  const result = await run(args);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedPage(result.stdout);
}

describe('repeat task configs', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
    const absent = path.join(tmpdir(), `tftasks-repeat-absent-${randomUUID()}`);
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
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-repeat-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;
    expect((await run(['init'])).exitCode).toBe(0);
    return dataDir;
  }

  async function seedMixed(): Promise<MixedFixture> {
    const dataDir = await initHome();
    const inbox = await createTask({ name: 'Inbox', priority: 'medium', detail: 'token-inbox' });
    const child = await createTask({
      name: 'Child',
      priority: 'low',
      parentId: inbox.id,
      detail: 'token-child',
    });
    const createdDone = await createTask({ name: 'Done', priority: 'high', detail: 'token-done' });
    const done = await finishTask(createdDone.id);
    const daily = await createConfig(
      configBody({ name: 'Daily', priority: 'high', timesPerPeriod: 2, detail: 'token-daily' }),
    );
    const off = await createConfig(
      configBody({ name: 'Off', priority: 'low', enabled: false, detail: 'token-off' }),
    );
    const later = await createConfig(
      configBody({ name: 'Later', priority: 'medium', detail: 'token-later' }),
    );
    setConfigCreatedAt(dataDir, later.id, isoLocalNoon(2));
    const spent = await createConfig(
      configBody({ name: 'Spent', priority: 'medium', detail: 'token-spent' }),
    );
    const generated = await finishConfig(spent.id);
    return { dataDir, inbox, child, done, daily, off, later, spent, generated };
  }

  it.each([
    'repeat-task-config:create',
    'repeat-task-config:read',
    'repeat-task-config:update',
    'repeat-task-config:delete',
    'repeat-task-config:list',
    'task:list',
    'task:finish',
  ])(
    '%s returns the not-initialized error and does not create the data directory',
    async (command) => {
      const dataDir = process.env.TFTASKS_HOME;
      if (dataDir === undefined) {
        throw new Error('TFTASKS_HOME should be set');
      }
      const args = uninitializedArgs(command);
      const result = await run(args);

      expect(result).toEqual(jsonError('Not initialized. Run tftasks init.'));
      expect(existsSync(dataDir)).toBe(false);
    },
  );

  it('creates a config without inserting a task, and reads the stored detail', async () => {
    const dataDir = await initHome();

    const created = await createConfig(
      configBody({ detail: 'Ship it', period: 'week', interval: 2, timesPerPeriod: 3 }),
    );

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created.detailPath).toBe(
      path.join(dataDir, 'files', 'repeat-task-config-attachments', created.id, 'index.md'),
    );
    expect(path.isAbsolute(created.detailPath)).toBe(true);
    expect(created.createdAt).toMatch(ISO_TIME);
    expect(created.updatedAt).toBe(created.createdAt);
    expect(created).toMatchObject({
      name: 'Daily',
      priority: 'high',
      period: 'week',
      interval: 2,
      timesPerPeriod: 3,
      enabled: true,
      detail: 'Ship it',
    });
    expect(await readFile(created.detailPath, 'utf8')).toBe('Ship it');
    expect(await readConfig(created.id)).toEqual(created);
    expect(taskCount(dataDir)).toBe(0);
    expect(configCount(dataDir)).toBe(1);
  });

  it('writes an empty detail file when detail is omitted', async () => {
    const dataDir = await initHome();

    const created = await createConfig(configBody());

    expect(created.detail).toBe('');
    expect(await readFile(created.detailPath, 'utf8')).toBe('');
    expect(taskCount(dataDir)).toBe(0);
  });

  it.each(INVALID_CREATE)('rejects create when %s', async (_label, body, error) => {
    const dataDir = await initHome();

    expect(await run(['repeat-task-config:create', '--params', JSON.stringify(body)])).toEqual(
      jsonError(error),
    );
    expect(configCount(dataDir)).toBe(0);
  });

  it('rejects missing params and non-object params for create', async () => {
    await initHome();

    expect(await run(['repeat-task-config:create'])).toEqual(
      jsonError('Missing --params or --params-file.'),
    );
    expect(await run(['repeat-task-config:create', '--params', '[]'])).toEqual(
      jsonError('Params must be a JSON object.'),
    );
    expect(await run(['repeat-task-config:create', 'extra'])).toEqual(
      jsonError('Unexpected argument: extra'),
    );
  });

  it('updates only the provided fields and leaves updatedAt unchanged when nothing changes', async () => {
    const dataDir = await initHome();
    const created = await createConfig(configBody({ detail: 'before', interval: 1 }));

    const same = await updateConfig({ id: created.id });
    expect(same).toEqual(created);

    const updated = await updateConfig({
      id: created.id,
      name: 'Renamed',
      detail: 'after',
      enabled: false,
      priority: 'low',
      period: 'week',
      interval: 3,
      timesPerPeriod: 4,
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Renamed',
      detail: 'after',
      enabled: false,
      priority: 'low',
      period: 'week',
      interval: 3,
      timesPerPeriod: 4,
      createdAt: created.createdAt,
    });
    expect(updated.updatedAt).not.toBe(created.updatedAt);
    expect(await readFile(updated.detailPath, 'utf8')).toBe('after');
    expect(await readConfig(created.id)).toEqual(updated);
    expect(taskCount(dataDir)).toBe(0);
  });

  it('rejects an invalid update without changing the config', async () => {
    await initHome();
    const created = await createConfig(configBody());

    expect(
      await run([
        'repeat-task-config:update',
        '--params',
        JSON.stringify({ id: created.id, interval: 0 }),
      ]),
    ).toEqual(jsonError('Invalid interval.'));
    expect(
      await run(['repeat-task-config:update', '--params', JSON.stringify({ name: 'A' })]),
    ).toEqual(jsonError('Missing field: id.'));
    expect(
      await run([
        'repeat-task-config:update',
        '--params',
        JSON.stringify({ id: created.id, status: 'complete' }),
      ]),
    ).toEqual(jsonError('Unknown field: status.'));
    expect(await readConfig(created.id)).toEqual(created);
  });

  it('returns not found when reading, updating, or deleting a missing config', async () => {
    await initHome();
    const id = randomUUID();

    expect(await run(['repeat-task-config:read', '--params', JSON.stringify({ id })])).toEqual(
      jsonError('Repeat task config not found.'),
    );
    expect(
      await run(['repeat-task-config:update', '--params', JSON.stringify({ id, name: 'A' })]),
    ).toEqual(jsonError('Repeat task config not found.'));
    expect(await run(['repeat-task-config:delete', '--params', JSON.stringify({ id })])).toEqual(
      jsonError('Repeat task config not found.'),
    );
  });

  it('deletes the config and its attachments without deleting generated tasks', async () => {
    const dataDir = await initHome();
    const config = await createConfig(configBody({ detail: 'notes' }));
    const generated = await finishConfig(config.id);

    const deleted = await run([
      'repeat-task-config:delete',
      '--params',
      JSON.stringify({ id: config.id }),
    ]);

    expect(deleted).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: `${JSON.stringify({ success: true }, null, 2)}\n`,
    });
    expect(existsSync(path.dirname(config.detailPath))).toBe(false);
    expect(configCount(dataDir)).toBe(0);
    expect(taskCount(dataDir)).toBe(1);

    const read = await run(['task:read', '--params', JSON.stringify({ id: generated.id })]);
    expect(read.exitCode).toBe(0);
    const task = parsedTask(read.stdout);
    expect(task).toMatchObject({
      id: generated.id,
      name: 'Daily',
      status: 'complete',
      detail: 'notes',
      repeatTaskConfigId: null,
    });
    expect(existsSync(task.detailPath)).toBe(true);
    expect(
      await run(['repeat-task-config:read', '--params', JSON.stringify({ id: config.id })]),
    ).toEqual(jsonError('Repeat task config not found.'));
  });

  it('finishes an enabled in-period config by copying a completed task', async () => {
    const dataDir = await initHome();
    const config = await createConfig(
      configBody({ name: 'Standup', priority: 'high', detail: 'notes', timesPerPeriod: 1 }),
    );
    expect(taskCount(dataDir)).toBe(0);

    const task = await finishConfig(config.id);

    expect(task).toMatchObject({
      name: 'Standup',
      status: 'complete',
      parentId: null,
      priority: 'high',
      repeatTaskConfigId: config.id,
      detail: 'notes',
    });
    expect(task.completedAt).toMatch(ISO_TIME);
    expect(task.completedAt).toBe(task.createdAt);
    expect(task.updatedAt).toBe(task.createdAt);
    expect(task.detailPath).toBe(
      path.join(dataDir, 'files', 'task-attachments', task.id, 'index.md'),
    );
    expect(await readFile(task.detailPath, 'utf8')).toBe('notes');
    expect(taskCount(dataDir)).toBe(1);

    await updateConfig({ id: config.id, detail: 'changed', name: 'Renamed' });
    const reread = await run(['task:read', '--params', JSON.stringify({ id: task.id })]);
    expect(parsedTask(reread.stdout)).toMatchObject({
      name: 'Standup',
      detail: 'notes',
      repeatTaskConfigId: config.id,
    });

    expect(
      await run([
        'task:finish',
        '--params',
        JSON.stringify({ kind: 'repeat-task-config', id: config.id }),
      ]),
    ).toEqual(jsonError('Repeat task config quota is already met for the current period.'));
    expect(taskCount(dataDir)).toBe(1);
  });

  it('does not create a task when the config is disabled, even if it is also outside the period', async () => {
    const dataDir = await initHome();
    const config = await createConfig(configBody({ enabled: false }));
    setConfigCreatedAt(dataDir, config.id, isoLocalNoon(2));

    expect(
      await run([
        'task:finish',
        '--params',
        JSON.stringify({ kind: 'repeat-task-config', id: config.id }),
      ]),
    ).toEqual(jsonError('Repeat task config is disabled.'));
    expect(taskCount(dataDir)).toBe(0);
  });

  it('does not create a task when the current period is not scheduled', async () => {
    const dataDir = await initHome();
    const future = await createConfig(configBody({ period: 'day', interval: 1 }));
    setConfigCreatedAt(dataDir, future.id, isoLocalNoon(2));
    const skipped = await createConfig(
      configBody({ name: 'Bimonthly', period: 'month', interval: 2 }),
    );
    setConfigCreatedAt(dataDir, skipped.id, isoPreviousMonthNoon());

    expect(
      await run([
        'task:finish',
        '--params',
        JSON.stringify({ kind: 'repeat-task-config', id: future.id }),
      ]),
    ).toEqual(jsonError('Repeat task config is not scheduled for the current period.'));
    expect(
      await run([
        'task:finish',
        '--params',
        JSON.stringify({ kind: 'repeat-task-config', id: skipped.id }),
      ]),
    ).toEqual(jsonError('Repeat task config is not scheduled for the current period.'));
    expect(taskCount(dataDir)).toBe(0);
  });

  it('ignores completions outside the current window when checking quota', async () => {
    const dataDir = await initHome();
    const config = await createConfig(configBody({ timesPerPeriod: 1 }));
    insertCompletedTask(dataDir, config.id, isoLocalNoon(-1));

    const task = await finishConfig(config.id);

    expect(task.repeatTaskConfigId).toBe(config.id);
    expect(task.status).toBe('complete');
    expect(taskCount(dataDir)).toBe(2);
    expect(
      await run([
        'task:finish',
        '--params',
        JSON.stringify({ kind: 'repeat-task-config', id: config.id }),
      ]),
    ).toEqual(jsonError('Repeat task config quota is already met for the current period.'));
    expect(taskCount(dataDir)).toBe(2);
  });

  it('rolls back config create when the attachment path is not a directory', async () => {
    const dataDir = await initHome();
    const blocked = path.join(dataDir, 'files', 'repeat-task-config-attachments');
    await writeFile(blocked, 'not a directory');

    const result = await run([
      'repeat-task-config:create',
      '--params',
      JSON.stringify(configBody({ detail: 'nope' })),
    ]);

    expect(result).toEqual(jsonError('Could not write repeat task config detail.'));
    expect(configCount(dataDir)).toBe(0);
    expect(await readFile(blocked, 'utf8')).toBe('not a directory');
  });

  it('rolls back repeat finish when the task attachment path is not a directory', async () => {
    const dataDir = await initHome();
    const config = await createConfig(configBody({ detail: 'notes' }));
    const blocked = path.join(dataDir, 'files', 'task-attachments');
    await writeFile(blocked, 'not a directory');

    const result = await run([
      'task:finish',
      '--params',
      JSON.stringify({ kind: 'repeat-task-config', id: config.id }),
    ]);

    expect(result).toEqual(jsonError('Could not write task detail.'));
    expect(taskCount(dataDir)).toBe(0);
    expect((await readConfig(config.id)).detail).toBe('notes');
  });

  it('lists incomplete tasks plus enabled configs that still have remaining occurrences', async () => {
    const fixture = await seedMixed();

    const page = await list('task:list');

    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 3 });
    expect(sortedNames(page)).toEqual(['Child', 'Daily', 'Inbox']);
    expect(findItem(page, 'Inbox')).toEqual({
      kind: 'task',
      id: fixture.inbox.id,
      name: 'Inbox',
      status: 'incomplete',
      parentId: null,
      priority: 'medium',
      repeatTaskConfigId: null,
      completedAt: null,
      createdAt: fixture.inbox.createdAt,
      updatedAt: fixture.inbox.updatedAt,
    });
    expect(findItem(page, 'Child')).toEqual({
      kind: 'task',
      id: fixture.child.id,
      name: 'Child',
      status: 'incomplete',
      parentId: fixture.inbox.id,
      priority: 'low',
      repeatTaskConfigId: null,
      completedAt: null,
      createdAt: fixture.child.createdAt,
      updatedAt: fixture.child.updatedAt,
    });
    expect(findItem(page, 'Daily')).toEqual({
      kind: 'repeat-task-config',
      id: fixture.daily.id,
      name: 'Daily',
      priority: 'high',
      period: 'day',
      interval: 1,
      timesPerPeriod: 2,
      enabled: true,
      remaining: 2,
      createdAt: fixture.daily.createdAt,
      updatedAt: fixture.daily.updatedAt,
    });
    for (const item of page.items) {
      expect(item).not.toHaveProperty('detail');
      expect(item).not.toHaveProperty('detailPath');
    }
  });

  it('filters the mixed list by status, priority, query, and parentId', async () => {
    const fixture = await seedMixed();

    expect(itemNames(await list('task:list', { priority: 'high' }))).toEqual(['Daily']);
    expect(itemNames(await list('task:list', { priority: 'low' }))).toEqual(['Child']);
    expect(itemNames(await list('task:list', { priority: 'medium' }))).toEqual(['Inbox']);

    expect(itemNames(await list('task:list', { query: 'TOKEN-INBOX' }))).toEqual(['Inbox']);
    expect(itemNames(await list('task:list', { query: 'token-daily' }))).toEqual(['Daily']);
    expect((await list('task:list', { query: 'token-done' })).total).toBe(0);
    expect((await list('task:list', { query: 'token-spent' })).total).toBe(0);
    expect((await list('task:list', { query: 'missing' })).total).toBe(0);

    const complete = await list('task:list', { status: 'complete' });
    expect(sortedNames(complete)).toEqual(['Done', 'Spent']);
    expect(complete.items.every((item) => item.kind === 'task')).toBe(true);
    expect(findItem(complete, 'Done')).toMatchObject({
      id: fixture.done.id,
      status: 'complete',
      parentId: null,
      completedAt: fixture.done.completedAt,
    });

    const all = await list('task:list', { status: 'all' });
    expect(all.total).toBe(8);
    expect(findItem(all, 'Off')).toMatchObject({
      kind: 'repeat-task-config',
      id: fixture.off.id,
      enabled: false,
      remaining: 1,
    });
    expect(findItem(all, 'Later')).toMatchObject({
      kind: 'repeat-task-config',
      id: fixture.later.id,
      enabled: true,
      remaining: 0,
    });
    const spentItems = all.items.filter((item) => item.name === 'Spent');
    expect(sortedKinds(spentItems)).toEqual(['repeat-task-config', 'task']);
    expect(spentItems.find((item) => item.kind === 'repeat-task-config')).toMatchObject({
      id: fixture.spent.id,
      remaining: 0,
    });
    expect(spentItems.find((item) => item.kind === 'task')).toMatchObject({
      id: fixture.generated.id,
      status: 'complete',
      repeatTaskConfigId: fixture.spent.id,
    });

    const spentQuery = await list('task:list', { status: 'all', query: 'token-spent' });
    expect(spentQuery.total).toBe(2);
    expect(itemNames(await list('task:list', { status: 'all', query: 'token-off' }))).toEqual([
      'Off',
    ]);
    expect(itemNames(await list('task:list', { status: 'all', query: 'token-done' }))).toEqual([
      'Done',
    ]);

    expect(itemNames(await list('task:list', { parentId: null }))).toEqual(['Inbox']);
    const roots = await list('task:list', { status: 'all', parentId: null });
    expect(sortedNames(roots)).toEqual(['Done', 'Inbox', 'Spent']);
    expect(roots.items.every((item) => item.kind === 'task')).toBe(true);
    expect(itemNames(await list('task:list', { parentId: fixture.inbox.id }))).toEqual(['Child']);
    expect((await list('task:list', { parentId: null, query: 'token-daily' })).total).toBe(0);
    expect(itemNames(await list('task:list', { parentId: null, query: 'TOKEN-INBOX' }))).toEqual([
      'Inbox',
    ]);
  });

  it('sorts and pages the mixed list', async () => {
    const fixture = await seedMixed();

    const byName = await list('task:list', { sort: 'name', order: 'asc', pageSize: 1 });
    expect(byName).toMatchObject({ page: 1, pageSize: 1, total: 3 });
    expect(itemNames(byName)).toEqual(['Child']);
    expect(
      itemNames(await list('task:list', { sort: 'name', order: 'asc', pageSize: 1, page: 2 })),
    ).toEqual(['Daily']);
    expect(itemNames(await list('task:list', { sort: 'name', order: 'desc' }))).toEqual([
      'Inbox',
      'Daily',
      'Child',
    ]);

    expect(itemNames(await list('task:list', { sort: 'priority', order: 'asc' }))).toEqual([
      'Child',
      'Inbox',
      'Daily',
    ]);
    expect(itemNames(await list('task:list', { sort: 'priority', order: 'desc' }))).toEqual([
      'Daily',
      'Inbox',
      'Child',
    ]);

    setTaskCreatedAt(fixture.dataDir, fixture.inbox.id, '2022-01-01T00:00:00.000Z');
    setTaskCreatedAt(fixture.dataDir, fixture.child.id, '2024-01-01T00:00:00.000Z');
    setConfigCreatedAt(fixture.dataDir, fixture.daily.id, '2023-01-01T00:00:00.000Z');
    expect(itemNames(await list('task:list'))).toEqual(['Child', 'Daily', 'Inbox']);
    expect(itemNames(await list('task:list', { order: 'asc' }))).toEqual([
      'Inbox',
      'Daily',
      'Child',
    ]);

    const beyond = await list('task:list', { page: 2 });
    expect(beyond).toMatchObject({ page: 2, pageSize: 20, total: 3, items: [] });
  });

  it('lists every repeat config, including disabled and unscheduled ones', async () => {
    const fixture = await seedMixed();

    const page = await list('repeat-task-config:list', { sort: 'name', order: 'asc' });

    expect(page.total).toBe(4);
    expect(itemNames(page)).toEqual(['Daily', 'Later', 'Off', 'Spent']);
    expect(findItem(page, 'Off')).toEqual({
      id: fixture.off.id,
      name: 'Off',
      priority: 'low',
      period: 'day',
      interval: 1,
      timesPerPeriod: 1,
      enabled: false,
      createdAt: fixture.off.createdAt,
      updatedAt: fixture.off.updatedAt,
    });
    expect(findItem(page, 'Off')).not.toHaveProperty('detail');
    expect(findItem(page, 'Off')).not.toHaveProperty('remaining');
    expect(findItem(page, 'Off')).not.toHaveProperty('kind');
    expect(itemNames(await list('repeat-task-config:list', { enabled: false }))).toEqual(['Off']);
    expect(
      itemNames(
        await list('repeat-task-config:list', { enabled: true, sort: 'name', order: 'asc' }),
      ),
    ).toEqual(['Daily', 'Later', 'Spent']);
    expect(itemNames(await list('repeat-task-config:list', { query: 'TOKEN-LATER' }))).toEqual([
      'Later',
    ]);
    expect(itemNames(await list('repeat-task-config:list', { query: 'off' }))).toEqual(['Off']);
    expect((await list('repeat-task-config:list', { priority: 'high' })).total).toBe(1);
  });

  it('sorts configs by updatedAt and pages past the default page size', async () => {
    await initHome();
    const first = await createConfig(configBody({ name: 'First' }));
    const second = await createConfig(configBody({ name: 'Second' }));
    await updateConfig({ id: first.id, name: 'First renamed' });

    expect(
      itemNames(await list('repeat-task-config:list', { sort: 'updatedAt', order: 'asc' })),
    ).toEqual(['Second', 'First renamed']);
    expect(second.id).not.toBe(first.id);

    await Array.from({ length: 21 }, (_, index) => index).reduce(async (previous, index) => {
      await previous;
      await createConfig(
        configBody({ name: `item-${String(index).padStart(2, '0')}`, priority: 'low' }),
      );
    }, Promise.resolve());
    const page = await list('repeat-task-config:list', {
      sort: 'name',
      order: 'asc',
      priority: 'low',
    });
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 21 });
    expect(page.items).toHaveLength(20);
    expect(itemName(page.items[0])).toBe('item-00');
    expect(itemName(page.items[19])).toBe('item-19');
    const next = await list('repeat-task-config:list', {
      sort: 'name',
      order: 'asc',
      priority: 'low',
      page: 2,
    });
    expect(itemNames(next)).toEqual(['item-20']);
    expect(next).toMatchObject({ page: 2, pageSize: 20, total: 21 });

    const capped = await list('repeat-task-config:list', { pageSize: 100, priority: 'low' });
    expect(capped.pageSize).toBe(100);
    expect(capped.total).toBe(21);
  });

  it.each([
    ['task:list', { page: 0 }, 'Invalid page.'],
    ['task:list', { pageSize: 101 }, 'Invalid pageSize.'],
    ['task:list', { pageSize: 0 }, 'Invalid pageSize.'],
    ['task:list', { sort: 'id' }, 'Invalid sort.'],
    ['task:list', { order: 'ascending' }, 'Invalid order.'],
    ['task:list', { status: 'open' }, 'Invalid status.'],
    ['task:list', { query: 1 }, 'Invalid query.'],
    ['task:list', { priority: 'urgent' }, 'Invalid priority.'],
    ['task:list', { parentId: 'nope' }, 'Invalid parentId.'],
    ['task:list', { detail: 'x' }, 'Unknown field: detail.'],
    ['repeat-task-config:list', { enabled: 'yes' }, 'Invalid enabled.'],
    ['repeat-task-config:list', { status: 'all' }, 'Unknown field: status.'],
    ['repeat-task-config:list', { page: 1.5 }, 'Invalid page.'],
  ] as const)('rejects %s params (%s)', async (command, params, error) => {
    await initHome();

    expect(await run([command, '--params', JSON.stringify(params)])).toEqual(jsonError(error));
  });

  it('lists the new commands in help', async () => {
    const result = await run(['help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('task:list');
    expect(result.stdout).toContain('repeat-task-config:create');
    expect(result.stdout).toContain('repeat-task-config:read');
    expect(result.stdout).toContain('repeat-task-config:update');
    expect(result.stdout).toContain('repeat-task-config:delete');
    expect(result.stdout).toContain('repeat-task-config:list');
  });
});

function uninitializedArgs(command: string): string[] {
  if (command === 'task:list' || command === 'repeat-task-config:list') {
    return [command];
  }
  if (command === 'repeat-task-config:create') {
    return [command, '--params', JSON.stringify(configBody())];
  }
  if (command === 'task:finish') {
    return [command, '--params', JSON.stringify({ kind: 'repeat-task-config', id: randomUUID() })];
  }
  const id =
    command === 'repeat-task-config:update'
      ? { id: randomUUID(), name: 'A' }
      : { id: randomUUID() };
  return [command, '--params', JSON.stringify(id)];
}

function itemNames(page: Page): string[] {
  return page.items.map((item) => itemName(item));
}

function sortedNames(page: Page): string[] {
  return itemNames(page).toSorted(compareText);
}

function sortedKinds(items: readonly Record<string, unknown>[]): string[] {
  return items.map((item) => itemKind(item)).toSorted(compareText);
}

function itemKind(item: Record<string, unknown>): string {
  if (typeof item.kind !== 'string') {
    throw new Error('Expected a list item kind');
  }
  return item.kind;
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function itemName(item: Record<string, unknown> | undefined): string {
  if (item === undefined || typeof item.name !== 'string') {
    throw new Error('Expected a named list item');
  }
  return item.name;
}

function findItem(page: Page, name: string): Record<string, unknown> | undefined {
  return page.items.find((item) => item.name === name);
}

function isoLocalNoon(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function isoPreviousMonthNoon(): string {
  const date = new Date();
  date.setDate(15);
  date.setMonth(date.getMonth() - 1);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function setConfigCreatedAt(dataDir: string, id: string, createdAt: string): void {
  withDb(dataDir, (db) => {
    db.prepare('UPDATE repeat_task_configs SET created_at = ? WHERE id = ?').run(createdAt, id);
  });
}

function setTaskCreatedAt(dataDir: string, id: string, createdAt: string): void {
  withDb(dataDir, (db) => {
    db.prepare('UPDATE tasks SET created_at = ? WHERE id = ?').run(createdAt, id);
  });
}

function insertCompletedTask(dataDir: string, configId: string, completedAt: string): void {
  withDb(dataDir, (db) => {
    db.prepare(
      `INSERT INTO tasks (
        id, name, status, parent_id, priority, repeat_task_config_id,
        completed_at, created_at, updated_at
      ) VALUES (?, 'Past', 'complete', NULL, 'low', ?, ?, ?, ?)`,
    ).run(randomUUID(), configId, completedAt, completedAt, completedAt);
  });
}

function taskCount(dataDir: string): number {
  return countRows(dataDir, 'tasks');
}

function configCount(dataDir: string): number {
  return countRows(dataDir, 'repeat_task_configs');
}

function countRows(dataDir: string, table: 'tasks' | 'repeat_task_configs'): number {
  return withDb(dataDir, (db) => {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
    if (row === undefined || typeof row.count !== 'number') {
      throw new Error(`Unexpected count from ${table}.`);
    }
    return row.count;
  });
}

function withDb<T>(dataDir: string, use: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(path.join(dataDir, 'tftasks.db'));
  try {
    return use(db);
  } finally {
    db.close();
  }
}

function isTaskEnvelope(value: unknown): value is { task: TaskJson } {
  return typeof value === 'object' && value !== null && 'task' in value && isTask(value.task);
}

function isTask(value: unknown): value is TaskJson {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'id' in value &&
    'name' in value &&
    'status' in value &&
    'detail' in value &&
    'detailPath' in value
  );
}

function isConfigEnvelope(value: unknown): value is { config: ConfigJson } {
  return typeof value === 'object' && value !== null && 'config' in value && isConfig(value.config);
}

function isConfig(value: unknown): value is ConfigJson {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'id' in value &&
    'name' in value &&
    'period' in value &&
    'detail' in value &&
    'detailPath' in value &&
    'enabled' in value
  );
}

function isPage(value: unknown): value is Page & { success: true } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('success' in value) || value.success !== true) {
    return false;
  }
  if (!('items' in value) || !Array.isArray(value.items)) {
    return false;
  }
  if (!('page' in value) || typeof value.page !== 'number') {
    return false;
  }
  if (!('pageSize' in value) || typeof value.pageSize !== 'number') {
    return false;
  }
  if (!('total' in value) || typeof value.total !== 'number') {
    return false;
  }
  return value.items.every(
    (item) => typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}
