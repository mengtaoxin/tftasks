import type { DatabaseSync } from 'node:sqlite';
import { AppError } from '../errors.ts';

export type TaskStatus = 'incomplete' | 'complete';
export type TaskPriority = 'low' | 'medium' | 'high';

export function assertCanUpdate(status: TaskStatus): void {
  if (status === 'complete') {
    throw new AppError('Completed tasks cannot be edited.');
  }
}

export function assertParentAcceptsSubtask(
  db: DatabaseSync,
  parentId: string,
  taskId: string,
): void {
  const status = parentStatus(db, parentId);
  if (status === undefined) {
    throw new AppError('Parent task not found.');
  }
  if (status === 'complete') {
    throw new AppError('Cannot add a subtask to a completed task.');
  }
  if (isSelfOrDescendant(db, taskId, parentId)) {
    throw new AppError('Cannot parent a task to itself or its descendant.');
  }
}

export function assertCanFinishTask(db: DatabaseSync, taskId: string, status: TaskStatus): void {
  if (status === 'complete') {
    throw new AppError('Task is already complete.');
  }
  if (hasIncompleteDescendant(db, taskId)) {
    throw new AppError('Task has incomplete subtasks.');
  }
}

export function assertCanDeleteTask(db: DatabaseSync, taskId: string): void {
  const row = db.prepare('SELECT 1 AS found FROM tasks WHERE parent_id = ? LIMIT 1').get(taskId);
  if (row !== undefined) {
    throw new AppError('Task has subtasks.');
  }
}

function parentStatus(db: DatabaseSync, parentId: string): TaskStatus | undefined {
  const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get(parentId);
  if (row === undefined) {
    return undefined;
  }
  if (row.status !== 'incomplete' && row.status !== 'complete') {
    throw new Error('Unexpected status from tasks.');
  }
  return row.status;
}

function isSelfOrDescendant(db: DatabaseSync, taskId: string, parentId: string): boolean {
  if (taskId === parentId) {
    return true;
  }
  const row = db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
        SELECT id FROM tasks WHERE parent_id = ?
        UNION
        SELECT tasks.id
        FROM tasks
        INNER JOIN descendants ON tasks.parent_id = descendants.id
      )
      SELECT 1 AS found FROM descendants WHERE id = ? LIMIT 1`,
    )
    .get(taskId, parentId);
  return row !== undefined;
}

function hasIncompleteDescendant(db: DatabaseSync, taskId: string): boolean {
  const row = db
    .prepare(
      `WITH RECURSIVE descendants(id, status) AS (
        SELECT id, status FROM tasks WHERE parent_id = ?
        UNION
        SELECT tasks.id, tasks.status
        FROM tasks
        INNER JOIN descendants ON tasks.parent_id = descendants.id
      )
      SELECT 1 AS found FROM descendants WHERE status = 'incomplete' LIMIT 1`,
    )
    .get(taskId);
  return row !== undefined;
}
