import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../db/open.ts';
import { AppError } from '../errors.ts';
import {
  readTaskDetail,
  removeTaskAttachments,
  taskAttachmentDir,
  taskDetailPath,
  writeTaskDetail,
} from '../files/attachments.ts';
import {
  assertCanDeleteTask,
  assertCanFinishTask,
  assertCanUpdate,
  assertParentAcceptsSubtask,
  assertStartNotAfterEnd,
  type TaskPriority,
  type TaskStatus,
} from './rules.ts';

export type Task = {
  readonly id: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly parentId: string | null;
  readonly priority: TaskPriority;
  readonly repeatTaskConfigId: string | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly detail: string;
  readonly detailPath: string;
};

export type CreateTaskInput = {
  readonly name: string;
  readonly priority: TaskPriority;
  readonly detail: string;
  readonly parentId: string | null;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
};

export type UpdateTaskInput = {
  readonly id: string;
  readonly name?: string;
  readonly priority?: TaskPriority;
  readonly detail?: string;
  readonly parentId?: string | null;
  readonly startsAt?: string | null;
  readonly endsAt?: string | null;
};

type TaskRow = {
  id: string;
  name: string;
  status: TaskStatus;
  parentId: string | null;
  priority: TaskPriority;
  repeatTaskConfigId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT_TASK = `SELECT id, name, status, parent_id, priority, repeat_task_config_id,
  starts_at, ends_at, completed_at, created_at, updated_at
  FROM tasks WHERE id = ?`;

export async function createTask(dataDir: string, input: CreateTaskInput): Promise<Task> {
  return withDatabase(dataDir, async (db) => {
    const id = randomUUID();
    const now = new Date().toISOString();
    if (input.parentId !== null) {
      assertParentAcceptsSubtask(db, input.parentId, id);
    }
    assertStartNotAfterEnd(input.startsAt, input.endsAt);

    const detailPath = taskDetailPath(dataDir, id);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO tasks (
          id, name, status, parent_id, priority, repeat_task_config_id,
          starts_at, ends_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, 'incomplete', ?, ?, NULL, ?, ?, NULL, ?, ?)`,
      ).run(id, input.name, input.parentId, input.priority, input.startsAt, input.endsAt, now, now);
    } catch (error) {
      rollback(db);
      throw error;
    }

    try {
      await writeTaskDetail(detailPath, input.detail);
    } catch (error: unknown) {
      rollback(db);
      await discardNewAttachments(dataDir, id);
      throw new AppError('Could not write task detail.', { cause: error });
    }

    try {
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      await discardNewAttachments(dataDir, id);
      throw error;
    }

    return loadTask(db, dataDir, id);
  });
}

export async function readTask(dataDir: string, id: string): Promise<Task> {
  return withDatabase(dataDir, (db) => loadTask(db, dataDir, id));
}

export async function updateTask(dataDir: string, input: UpdateTaskInput): Promise<Task> {
  return withDatabase(dataDir, async (db) => {
    const existing = await loadTask(db, dataDir, input.id);
    assertCanUpdate(existing.status);
    if (input.parentId !== undefined && input.parentId !== null) {
      assertParentAcceptsSubtask(db, input.parentId, input.id);
    }

    const name = input.name ?? existing.name;
    const priority = input.priority ?? existing.priority;
    const parentId = input.parentId === undefined ? existing.parentId : input.parentId;
    const detail = input.detail === undefined ? existing.detail : input.detail;
    const startsAt = input.startsAt === undefined ? existing.startsAt : input.startsAt;
    const endsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt;
    assertStartNotAfterEnd(startsAt, endsAt);
    if (
      name === existing.name &&
      priority === existing.priority &&
      parentId === existing.parentId &&
      detail === existing.detail &&
      startsAt === existing.startsAt &&
      endsAt === existing.endsAt
    ) {
      return existing;
    }

    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    let replaced = false;
    try {
      db.prepare(
        `UPDATE tasks
         SET name = ?, priority = ?, parent_id = ?, starts_at = ?, ends_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(name, priority, parentId, startsAt, endsAt, now, input.id);
      if (detail !== existing.detail) {
        try {
          await writeTaskDetail(existing.detailPath, detail);
          replaced = true;
        } catch (error: unknown) {
          throw new AppError('Could not write task detail.', { cause: error });
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      if (replaced) {
        await writeTaskDetail(existing.detailPath, existing.detail);
      }
      throw error;
    }

    return loadTask(db, dataDir, input.id);
  });
}

export async function deleteTask(dataDir: string, id: string): Promise<void> {
  return withDatabase(dataDir, async (db) => {
    requireRow(db, id);
    assertCanDeleteTask(db, id);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      try {
        await removeTaskAttachments(dataDir, id);
      } catch (error: unknown) {
        throw new AppError('Could not remove task attachments.', { cause: error });
      }
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      throw error;
    }
  });
}

export async function finishTask(dataDir: string, id: string): Promise<Task> {
  return withDatabase(dataDir, async (db) => {
    const existing = requireRow(db, id);
    assertCanFinishTask(db, id, existing.status);
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE tasks
         SET status = 'complete', completed_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(now, now, id);
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      throw error;
    }
    return loadTask(db, dataDir, id);
  });
}

async function withDatabase<T>(dataDir: string, use: (db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = openDatabase(dataDir);
  try {
    return await use(db);
  } finally {
    db.close();
  }
}

async function loadTask(db: DatabaseSync, dataDir: string, id: string): Promise<Task> {
  const row = requireRow(db, id);
  const detailPath = taskDetailPath(dataDir, id);
  let detail: string;
  try {
    detail = await readTaskDetail(detailPath);
  } catch (error: unknown) {
    throw new AppError('Could not read task detail.', { cause: error });
  }
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    parentId: row.parentId,
    priority: row.priority,
    repeatTaskConfigId: row.repeatTaskConfigId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    detail,
    detailPath,
  };
}

function requireRow(db: DatabaseSync, id: string): TaskRow {
  const row = db.prepare(SELECT_TASK).get(id);
  if (row === undefined) {
    throw new AppError('Task not found.');
  }
  return {
    id: requiredText(row.id, 'id'),
    name: requiredText(row.name, 'name'),
    status: requiredStatus(row.status),
    parentId: nullableText(row.parent_id, 'parent_id'),
    priority: requiredPriority(row.priority),
    repeatTaskConfigId: nullableText(row.repeat_task_config_id, 'repeat_task_config_id'),
    startsAt: nullableText(row.starts_at, 'starts_at'),
    endsAt: nullableText(row.ends_at, 'ends_at'),
    completedAt: nullableText(row.completed_at, 'completed_at'),
    createdAt: requiredText(row.created_at, 'created_at'),
    updatedAt: requiredText(row.updated_at, 'updated_at'),
  };
}

function requiredText(value: unknown, key: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Unexpected ${key} from tasks.`);
  }
  return value;
}

function nullableText(value: unknown, key: string): string | null {
  if (value === null) {
    return null;
  }
  return requiredText(value, key);
}

function requiredStatus(value: unknown): TaskStatus {
  if (value !== 'incomplete' && value !== 'complete') {
    throw new Error('Unexpected status from tasks.');
  }
  return value;
}

function requiredPriority(value: unknown): TaskPriority {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new Error('Unexpected priority from tasks.');
  }
  return value;
}

function rollback(db: DatabaseSync): void {
  if (db.isTransaction) {
    db.exec('ROLLBACK');
  }
}

async function discardNewAttachments(dataDir: string, taskId: string): Promise<void> {
  try {
    await rm(taskAttachmentDir(dataDir, taskId), { recursive: true, force: true });
  } catch (error: unknown) {
    if (isMissingAttachmentPath(error)) {
      return;
    }
    throw error;
  }
}

function isMissingAttachmentPath(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}
