import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
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

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function jsonError(error: string) {
  return {
    exitCode: 1,
    stderr: '',
    stdout: `${JSON.stringify({ success: false, error }, null, 2)}\n`,
  };
}

function parsedTask(stdout: string): TaskJson {
  const body: unknown = JSON.parse(stdout);
  if (!isTaskEnvelope(body)) {
    throw new Error('Expected a task envelope');
  }
  return body.task;
}

function expectStoredTask(task: TaskJson, dataDir: string): void {
  expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(task.detailPath).toBe(
    path.join(dataDir, 'files', 'task-attachments', task.id, 'index.md'),
  );
  expect(path.isAbsolute(task.detailPath)).toBe(true);
  expect(task.createdAt).toMatch(ISO_TIME);
  expect(task.updatedAt).toMatch(ISO_TIME);
  expect(task.repeatTaskConfigId).toBeNull();
  expect(task.completedAt === null || ISO_TIME.test(task.completedAt)).toBe(true);
}

async function create(body: Record<string, unknown>): Promise<TaskJson> {
  const result = await run(['task:create', '--params', JSON.stringify(body)]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedTask(result.stdout);
}

async function read(id: string): Promise<TaskJson> {
  const result = await run(['task:read', '--params', JSON.stringify({ id })]);
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  return parsedTask(result.stdout);
}

describe('tasks', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
    const absent = path.join(tmpdir(), `tftasks-task-absent-${randomUUID()}`);
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
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-task-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;
    expect((await run(['init'])).exitCode).toBe(0);
    return dataDir;
  }

  it.each(['task:create', 'task:read', 'task:update', 'task:delete', 'task:finish'])(
    '%s returns the not-initialized error and does not create the data directory',
    async (command) => {
      const dataDir = process.env.TFTASKS_HOME;
      if (dataDir === undefined) {
        throw new Error('TFTASKS_HOME should be set');
      }
      const params =
        command === 'task:create'
          ? { name: 'Write tests', priority: 'high' }
          : command === 'task:finish'
            ? { kind: 'task', id: randomUUID() }
            : { id: randomUUID() };

      const result = await run([command, '--params', JSON.stringify(params)]);

      expect(result).toEqual(jsonError('Not initialized. Run tftasks init.'));
      expect(existsSync(dataDir)).toBe(false);
    },
  );

  it('creates an incomplete task and stores its detail', async () => {
    const dataDir = await initHome();

    const result = await run([
      'task:create',
      '--params',
      JSON.stringify({ name: 'Write tests', priority: 'high', detail: 'Ship it' }),
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const task = parsedTask(result.stdout);
    expectStoredTask(task, dataDir);
    expect(task).toMatchObject({
      name: 'Write tests',
      status: 'incomplete',
      parentId: null,
      priority: 'high',
      completedAt: null,
      detail: 'Ship it',
    });
    expect(task.createdAt).toBe(task.updatedAt);
    expect(await readFile(task.detailPath, 'utf8')).toBe('Ship it');
    expect(await read(task.id)).toEqual(task);
  });

  it('writes an empty detail file when detail is omitted', async () => {
    const dataDir = await initHome();

    const task = await create({ name: 'Empty', priority: 'low', parentId: null });

    expectStoredTask(task, dataDir);
    expect(task.detail).toBe('');
    expect(task.parentId).toBeNull();
    expect(await readFile(task.detailPath, 'utf8')).toBe('');
  });

  it('creates a subtask under an incomplete parent', async () => {
    const dataDir = await initHome();
    const parent = await create({ name: 'Parent', priority: 'medium' });

    const child = await create({
      name: 'Child',
      priority: 'low',
      parentId: parent.id,
      detail: 'nested',
    });

    expect(child.parentId).toBe(parent.id);
    expect(child.detail).toBe('nested');
    expectStoredTask(child, dataDir);
  });

  it('rejects missing params, non-object params, unknown fields, and invalid create input', async () => {
    const dataDir = await initHome();

    expect(await run(['task:create'])).toEqual(jsonError('Missing --params or --params-file.'));
    expect(await run(['task:create', '--params', '[]'])).toEqual(
      jsonError('Params must be a JSON object.'),
    );
    expect(await run(['task:create', 'extra'])).toEqual(jsonError('Unexpected argument: extra'));
    expect(
      await run([
        'task:create',
        '--params',
        JSON.stringify({ name: 'A', priority: 'low', status: 'complete' }),
      ]),
    ).toEqual(jsonError('Unknown field: status.'));
    expect(await run(['task:create', '--params', JSON.stringify({ priority: 'low' })])).toEqual(
      jsonError('Missing field: name.'),
    );
    expect(await run(['task:create', '--params', JSON.stringify({ name: 'A' })])).toEqual(
      jsonError('Missing field: priority.'),
    );
    expect(
      await run(['task:create', '--params', JSON.stringify({ name: 'A', priority: 'urgent' })]),
    ).toEqual(jsonError('Invalid priority.'));
    expect(
      await run(['task:create', '--params', JSON.stringify({ name: '', priority: 'low' })]),
    ).toEqual(jsonError('Invalid name.'));
    expect(
      await run([
        'task:create',
        '--params',
        JSON.stringify({ name: 'A', priority: 'low', detail: 1 }),
      ]),
    ).toEqual(jsonError('Invalid detail.'));
    expect(
      await run([
        'task:create',
        '--params',
        JSON.stringify({ name: 'A', priority: 'low', parentId: randomUUID() }),
      ]),
    ).toEqual(jsonError('Parent task not found.'));
    expect(taskNames(dataDir)).toEqual([]);
  });

  it('reads params from a file relative to the data directory', async () => {
    const dataDir = await initHome();
    await writeFile(
      path.join(dataDir, 'create.json'),
      JSON.stringify({ name: 'From file', priority: 'medium', detail: 'body' }),
    );

    const result = await run(['task:create', '--params-file', 'create.json']);

    expect(result.exitCode).toBe(0);
    const task = parsedTask(result.stdout);
    expect(task).toMatchObject({ name: 'From file', priority: 'medium', detail: 'body' });
  });

  it('returns Task not found when the id is unknown', async () => {
    await initHome();
    const id = randomUUID();

    expect(await run(['task:read', '--params', JSON.stringify({ id })])).toEqual(
      jsonError('Task not found.'),
    );
    expect(await run(['task:update', '--params', JSON.stringify({ id, name: 'Next' })])).toEqual(
      jsonError('Task not found.'),
    );
    expect(await run(['task:delete', '--params', JSON.stringify({ id })])).toEqual(
      jsonError('Task not found.'),
    );
    expect(await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id })])).toEqual(
      jsonError('Task not found.'),
    );
  });

  it('rejects an id that is not a uuid', async () => {
    await initHome();

    expect(await run(['task:read', '--params', JSON.stringify({ id: '../outside' })])).toEqual(
      jsonError('Invalid id.'),
    );
  });

  it('updates name, detail, priority, and parent, and can clear the parent', async () => {
    const dataDir = await initHome();
    const first = await create({ name: 'First', priority: 'low', detail: 'old' });
    const second = await create({ name: 'Second', priority: 'high' });
    const child = await create({
      name: 'Child',
      priority: 'medium',
      parentId: first.id,
      detail: 'stay',
    });

    const renamed = await run([
      'task:update',
      '--params',
      JSON.stringify({
        id: child.id,
        name: 'Child renamed',
        priority: 'high',
        detail: 'next',
        parentId: second.id,
      }),
    ]);

    expect(renamed.exitCode).toBe(0);
    const updated = parsedTask(renamed.stdout);
    expect(updated).toMatchObject({
      id: child.id,
      name: 'Child renamed',
      status: 'incomplete',
      priority: 'high',
      parentId: second.id,
      detail: 'next',
      createdAt: child.createdAt,
      completedAt: null,
    });
    expect(await readFile(updated.detailPath, 'utf8')).toBe('next');

    const cleared = await run([
      'task:update',
      '--params',
      JSON.stringify({ id: child.id, parentId: null }),
    ]);
    expect(parsedTask(cleared.stdout).parentId).toBeNull();

    const same = await read(child.id);
    expect(same.name).toBe('Child renamed');
    expect(taskNames(dataDir)).toEqual(['Child renamed', 'First', 'Second']);
  });

  it('rejects unknown update fields and leaves the task unchanged', async () => {
    await initHome();
    const task = await create({ name: 'Stay', priority: 'low', detail: 'body' });

    const result = await run([
      'task:update',
      '--params',
      JSON.stringify({ id: task.id, status: 'complete' }),
    ]);

    expect(result).toEqual(jsonError('Unknown field: status.'));
    expect(await read(task.id)).toEqual(task);
  });

  it('rejects edits and new children of a completed task', async () => {
    const dataDir = await initHome();
    const done = await create({ name: 'Done', priority: 'high', detail: 'frozen' });
    const other = await create({ name: 'Other', priority: 'low' });
    expect(
      (await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id: done.id })]))
        .exitCode,
    ).toBe(0);

    expect(
      await run(['task:update', '--params', JSON.stringify({ id: done.id, name: 'Changed' })]),
    ).toEqual(jsonError('Completed tasks cannot be edited.'));
    expect(
      await run([
        'task:create',
        '--params',
        JSON.stringify({ name: 'Child', priority: 'low', parentId: done.id }),
      ]),
    ).toEqual(jsonError('Cannot add a subtask to a completed task.'));
    expect(
      await run(['task:update', '--params', JSON.stringify({ id: other.id, parentId: done.id })]),
    ).toEqual(jsonError('Cannot add a subtask to a completed task.'));

    expect((await read(done.id)).name).toBe('Done');
    expect((await read(other.id)).parentId).toBeNull();
    expect((await readdir(path.join(dataDir, 'files', 'task-attachments'))).toSorted()).toEqual(
      [done.id, other.id].toSorted(),
    );
  });

  it('rejects a parent that is the task itself or its descendant', async () => {
    await initHome();
    const root = await create({ name: 'Root', priority: 'medium' });
    const child = await create({ name: 'Child', priority: 'low', parentId: root.id });
    const grandchild = await create({
      name: 'Grandchild',
      priority: 'low',
      parentId: child.id,
    });

    expect(
      await run(['task:update', '--params', JSON.stringify({ id: root.id, parentId: root.id })]),
    ).toEqual(jsonError('Cannot parent a task to itself or its descendant.'));
    expect(
      await run([
        'task:update',
        '--params',
        JSON.stringify({ id: root.id, parentId: grandchild.id }),
      ]),
    ).toEqual(jsonError('Cannot parent a task to itself or its descendant.'));
    expect((await read(root.id)).parentId).toBeNull();
    expect((await read(grandchild.id)).parentId).toBe(child.id);
  });

  it('refuses to delete a task that still has subtasks, then deletes a leaf and a completed task', async () => {
    const dataDir = await initHome();
    const parent = await create({ name: 'Parent', priority: 'high', detail: 'keep' });
    const child = await create({ name: 'Child', priority: 'low', parentId: parent.id });
    const done = await create({ name: 'Done', priority: 'medium', detail: 'gone' });
    expect(
      (await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id: done.id })]))
        .exitCode,
    ).toBe(0);

    expect(await run(['task:delete', '--params', JSON.stringify({ id: parent.id })])).toEqual(
      jsonError('Task has subtasks.'),
    );
    expect(existsSync(parent.detailPath)).toBe(true);
    expect(await read(child.id)).toMatchObject({ parentId: parent.id });

    const deletedChild = await run(['task:delete', '--params', JSON.stringify({ id: child.id })]);
    expect(deletedChild).toEqual({
      exitCode: 0,
      stderr: '',
      stdout: `${JSON.stringify({ success: true }, null, 2)}\n`,
    });
    expect(existsSync(path.join(dataDir, 'files', 'task-attachments', child.id))).toBe(false);
    expect(await run(['task:read', '--params', JSON.stringify({ id: child.id })])).toEqual(
      jsonError('Task not found.'),
    );

    const deletedParent = await run(['task:delete', '--params', JSON.stringify({ id: parent.id })]);
    expect(deletedParent.exitCode).toBe(0);
    expect(existsSync(path.join(dataDir, 'files', 'task-attachments', parent.id))).toBe(false);

    const deletedDone = await run(['task:delete', '--params', JSON.stringify({ id: done.id })]);
    expect(deletedDone.exitCode).toBe(0);
    expect(existsSync(done.detailPath)).toBe(false);
    expect(taskNames(dataDir)).toEqual([]);
  });

  it('finishes a task only after every descendant is complete, without finishing ancestors', async () => {
    await initHome();
    const root = await create({ name: 'Root', priority: 'high', detail: 'root body' });
    const child = await create({
      name: 'Child',
      priority: 'medium',
      parentId: root.id,
      detail: 'child body',
    });
    const grandchild = await create({
      name: 'Grandchild',
      priority: 'low',
      parentId: child.id,
    });

    expect(
      await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id: root.id })]),
    ).toEqual(jsonError('Task has incomplete subtasks.'));
    expect(
      await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id: child.id })]),
    ).toEqual(jsonError('Task has incomplete subtasks.'));
    expect((await read(root.id)).status).toBe('incomplete');
    expect((await read(child.id)).status).toBe('incomplete');

    const finishedGrandchild = await run([
      'task:finish',
      '--params',
      JSON.stringify({ kind: 'task', id: grandchild.id }),
    ]);
    expect(finishedGrandchild.exitCode).toBe(0);
    const completedGrandchild = parsedTask(finishedGrandchild.stdout);
    expect(completedGrandchild).toMatchObject({
      id: grandchild.id,
      status: 'complete',
      detail: '',
      parentId: child.id,
    });
    expect(completedGrandchild.completedAt).toMatch(ISO_TIME);
    expect(completedGrandchild.completedAt).toBe(completedGrandchild.updatedAt);
    expect((await read(child.id)).status).toBe('incomplete');
    expect((await read(root.id)).status).toBe('incomplete');

    const finishedChild = await run([
      'task:finish',
      '--params',
      JSON.stringify({ kind: 'task', id: child.id }),
    ]);
    expect(parsedTask(finishedChild.stdout)).toMatchObject({
      status: 'complete',
      detail: 'child body',
    });
    expect((await read(root.id)).status).toBe('incomplete');

    const finishedRoot = await run([
      'task:finish',
      '--params',
      JSON.stringify({ kind: 'task', id: root.id }),
    ]);
    expect(parsedTask(finishedRoot.stdout)).toMatchObject({
      status: 'complete',
      detail: 'root body',
      completedAt: expect.any(String),
    });

    expect(
      await run(['task:finish', '--params', JSON.stringify({ kind: 'task', id: root.id })]),
    ).toEqual(jsonError('Task is already complete.'));
  });

  it('returns not found when finishing a missing repeat task config and does not create a task', async () => {
    const dataDir = await initHome();

    const result = await run([
      'task:finish',
      '--params',
      JSON.stringify({ kind: 'repeat-task-config', id: randomUUID() }),
    ]);

    expect(result).toEqual(jsonError('Repeat task config not found.'));
    expect(
      await run(['task:finish', '--params', JSON.stringify({ kind: 'nope', id: randomUUID() })]),
    ).toEqual(jsonError('Invalid kind.'));
    expect(taskNames(dataDir)).toEqual([]);
  });

  it('rolls back a create when the attachment directory cannot be written', async () => {
    const dataDir = await initHome();
    const blocked = path.join(dataDir, 'files', 'task-attachments');
    await writeFile(blocked, 'not a directory');

    const result = await run([
      'task:create',
      '--params',
      JSON.stringify({ name: 'Blocked', priority: 'low', detail: 'nope' }),
    ]);

    expect(result).toEqual(jsonError('Could not write task detail.'));
    expect(taskNames(dataDir)).toEqual([]);
    expect(await readFile(blocked, 'utf8')).toBe('not a directory');
  });

  it('rolls back an update when the detail file cannot be replaced', async () => {
    const dataDir = await initHome();
    const task = await create({ name: 'Original', priority: 'low', detail: 'hello' });
    const attachmentDir = path.dirname(task.detailPath);
    chmodSync(attachmentDir, 0o555);
    try {
      const result = await run([
        'task:update',
        '--params',
        JSON.stringify({ id: task.id, name: 'Changed', detail: 'next' }),
      ]);

      expect(result).toEqual(jsonError('Could not write task detail.'));
    } finally {
      chmodSync(attachmentDir, 0o755);
    }

    expect(taskNames(dataDir)).toEqual(['Original']);
    expect(await readFile(task.detailPath, 'utf8')).toBe('hello');
    expect((await read(task.id)).name).toBe('Original');
  });

  it('rolls back a delete when the attachment directory cannot be removed', async () => {
    const dataDir = await initHome();
    const task = await create({ name: 'Keep', priority: 'medium', detail: 'safe' });
    const attachments = path.join(dataDir, 'files', 'task-attachments');
    chmodSync(attachments, 0o555);
    try {
      const result = await run(['task:delete', '--params', JSON.stringify({ id: task.id })]);

      expect(result).toEqual(jsonError('Could not remove task attachments.'));
    } finally {
      chmodSync(attachments, 0o755);
    }

    expect(await read(task.id)).toMatchObject({ name: 'Keep', detail: 'safe' });
    expect(existsSync(task.detailPath)).toBe(true);
  });

  it('lists the task commands in help', async () => {
    const result = await run(['help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('task:create');
    expect(result.stdout).toContain('task:read');
    expect(result.stdout).toContain('task:update');
    expect(result.stdout).toContain('task:delete');
    expect(result.stdout).toContain('task:finish');
  });
});

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

function taskNames(dataDir: string): string[] {
  const db = new DatabaseSync(path.join(dataDir, 'tftasks.db'));
  try {
    return db
      .prepare('SELECT name FROM tasks ORDER BY name')
      .all()
      .map((row) => {
        if (typeof row.name !== 'string') {
          throw new Error('Unexpected name from tasks.');
        }
        return row.name;
      });
  } finally {
    db.close();
  }
}
