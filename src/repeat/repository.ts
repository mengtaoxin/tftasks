import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { openDatabase } from '../db/open.ts';
import { AppError } from '../errors.ts';
import {
  readTaskDetail,
  removeRepeatConfigAttachments,
  removeTaskAttachments,
  repeatConfigDetailPath,
  taskDetailPath,
  writeTaskDetail,
} from '../files/attachments.ts';
import { includeByQuery, sortAndPage, type ListPage } from '../listing.ts';
import type { Task } from '../tasks/repository.ts';
import { readTask } from '../tasks/repository.ts';
import type { TaskPriority } from '../tasks/rules.ts';
import { assessSchedule, parseStoredTimestamp, type Period } from './schedule.ts';

export type RepeatConfigSummary = {
  readonly id: string;
  readonly name: string;
  readonly priority: TaskPriority;
  readonly period: Period;
  readonly interval: number;
  readonly timesPerPeriod: number;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RepeatTaskConfig = RepeatConfigSummary & {
  readonly detail: string;
  readonly detailPath: string;
};

export type CreateRepeatConfigInput = {
  readonly name: string;
  readonly priority: TaskPriority;
  readonly period: Period;
  readonly interval: number;
  readonly timesPerPeriod: number;
  readonly enabled: boolean;
  readonly detail: string;
};

export type UpdateRepeatConfigInput = {
  readonly id: string;
  readonly name?: string;
  readonly priority?: TaskPriority;
  readonly period?: Period;
  readonly interval?: number;
  readonly timesPerPeriod?: number;
  readonly enabled?: boolean;
  readonly detail?: string;
};

export type RepeatConfigListQuery = {
  readonly query: string | null;
  readonly priority: TaskPriority | null;
  readonly enabled: boolean | null;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: 'createdAt' | 'updatedAt' | 'name' | 'priority';
  readonly order: 'asc' | 'desc';
};

export type RepeatConfigFilter = {
  readonly priority: TaskPriority | null;
  readonly enabled: boolean | null;
  readonly query: string | null;
};

type ConfigRow = RepeatConfigSummary;

const SELECT_CONFIG = `SELECT id, name, priority, period, interval, times_per_period, enabled,
  created_at, updated_at
  FROM repeat_task_configs`;

export async function createRepeatTaskConfig(
  dataDir: string,
  input: CreateRepeatConfigInput,
): Promise<RepeatTaskConfig> {
  return withDatabase(dataDir, async (db) => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const detailPath = repeatConfigDetailPath(dataDir, id);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO repeat_task_configs (
          id, name, priority, period, interval, times_per_period, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.name,
        input.priority,
        input.period,
        input.interval,
        input.timesPerPeriod,
        enabledValue(input.enabled),
        now,
        now,
      );
    } catch (error) {
      rollback(db);
      throw error;
    }

    try {
      await writeTaskDetail(detailPath, input.detail);
    } catch (error: unknown) {
      rollback(db);
      await discardConfigAttachments(dataDir, id);
      throw new AppError('Could not write repeat task config detail.', { cause: error });
    }

    try {
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      await discardConfigAttachments(dataDir, id);
      throw error;
    }

    return loadConfig(db, dataDir, id);
  });
}

export async function readRepeatTaskConfig(dataDir: string, id: string): Promise<RepeatTaskConfig> {
  return withDatabase(dataDir, (db) => loadConfig(db, dataDir, id));
}

export async function updateRepeatTaskConfig(
  dataDir: string,
  input: UpdateRepeatConfigInput,
): Promise<RepeatTaskConfig> {
  return withDatabase(dataDir, async (db) => {
    const existing = await loadConfig(db, dataDir, input.id);
    const next = {
      name: input.name ?? existing.name,
      priority: input.priority ?? existing.priority,
      period: input.period ?? existing.period,
      interval: input.interval ?? existing.interval,
      timesPerPeriod: input.timesPerPeriod ?? existing.timesPerPeriod,
      enabled: input.enabled ?? existing.enabled,
      detail: input.detail === undefined ? existing.detail : input.detail,
    };
    if (
      next.name === existing.name &&
      next.priority === existing.priority &&
      next.period === existing.period &&
      next.interval === existing.interval &&
      next.timesPerPeriod === existing.timesPerPeriod &&
      next.enabled === existing.enabled &&
      next.detail === existing.detail
    ) {
      return existing;
    }

    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    let replaced = false;
    try {
      db.prepare(
        `UPDATE repeat_task_configs
         SET name = ?, priority = ?, period = ?, interval = ?, times_per_period = ?, enabled = ?,
             updated_at = ?
         WHERE id = ?`,
      ).run(
        next.name,
        next.priority,
        next.period,
        next.interval,
        next.timesPerPeriod,
        enabledValue(next.enabled),
        now,
        input.id,
      );
      if (next.detail !== existing.detail) {
        try {
          await writeTaskDetail(existing.detailPath, next.detail);
          replaced = true;
        } catch (error: unknown) {
          throw new AppError('Could not write repeat task config detail.', { cause: error });
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

    return loadConfig(db, dataDir, input.id);
  });
}

export async function deleteRepeatTaskConfig(dataDir: string, id: string): Promise<void> {
  return withDatabase(dataDir, async (db) => {
    requireRow(db, id);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM repeat_task_configs WHERE id = ?').run(id);
      try {
        await removeRepeatConfigAttachments(dataDir, id);
      } catch (error: unknown) {
        throw new AppError('Could not remove repeat task config attachments.', { cause: error });
      }
      db.exec('COMMIT');
    } catch (error) {
      rollback(db);
      throw error;
    }
  });
}

export async function finishRepeatTaskConfig(dataDir: string, id: string): Promise<Task> {
  const taskId = await withDatabase(dataDir, (db) => insertFinishedTask(db, dataDir, id));
  return readTask(dataDir, taskId);
}

export async function listRepeatTaskConfigs(
  dataDir: string,
  query: RepeatConfigListQuery,
): Promise<ListPage<RepeatConfigSummary>> {
  return withDatabase(dataDir, async (db) => {
    const items = await loadRepeatConfigSummaries(db, dataDir, {
      priority: query.priority,
      enabled: query.enabled,
      query: query.query,
    });
    return sortAndPage(items, query.sort, query.order, query.page, query.pageSize);
  });
}

export async function loadRepeatConfigSummaries(
  db: DatabaseSync,
  dataDir: string,
  filter: RepeatConfigFilter,
): Promise<RepeatConfigSummary[]> {
  const rows = selectConfigs(db, filter);
  const candidates = rows.map((row) => toConfigCandidate(row, dataDir));
  const matched = await includeByQuery(
    candidates,
    filter.query,
    'Could not read repeat task config detail.',
  );
  return matched.map((item) => ({
    id: item.id,
    name: item.name,
    priority: item.priority,
    period: item.period,
    interval: item.interval,
    timesPerPeriod: item.timesPerPeriod,
    enabled: item.enabled,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

async function insertFinishedTask(
  db: DatabaseSync,
  dataDir: string,
  configId: string,
): Promise<string> {
  const now = new Date();
  const iso = now.toISOString();
  db.exec('BEGIN IMMEDIATE');
  let createdId: string | undefined;
  try {
    const config = requireRow(db, configId);
    assertCanFinishConfig(db, config, now);
    const detail = await readConfigDetail(dataDir, configId);
    createdId = randomUUID();
    db.prepare(
      `INSERT INTO tasks (
        id, name, status, parent_id, priority, repeat_task_config_id,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, 'complete', NULL, ?, ?, ?, ?, ?)`,
    ).run(createdId, config.name, config.priority, configId, iso, iso, iso);
    try {
      await writeTaskDetail(taskDetailPath(dataDir, createdId), detail);
    } catch (error: unknown) {
      throw new AppError('Could not write task detail.', { cause: error });
    }
    db.exec('COMMIT');
    return createdId;
  } catch (error) {
    rollback(db);
    if (createdId !== undefined) {
      await discardTaskAttachments(dataDir, createdId);
    }
    throw error;
  }
}

function assertCanFinishConfig(db: DatabaseSync, config: ConfigRow, now: Date): void {
  if (!config.enabled) {
    throw new AppError('Repeat task config is disabled.');
  }
  const schedule = assessSchedule({
    createdAt: parseStoredTimestamp(config.createdAt),
    period: config.period,
    interval: config.interval,
    timesPerPeriod: config.timesPerPeriod,
    completedAt: loadCompletionDates(db, config.id),
    now,
  });
  if (!schedule.active) {
    throw new AppError('Repeat task config is not scheduled for the current period.');
  }
  if (schedule.remaining <= 0) {
    throw new AppError('Repeat task config quota is already met for the current period.');
  }
}

function loadCompletionDates(db: DatabaseSync, configId: string): Date[] {
  const rows = db
    .prepare(
      `SELECT completed_at FROM tasks
       WHERE repeat_task_config_id = ? AND status = 'complete' AND completed_at IS NOT NULL`,
    )
    .all(configId);
  return rows.map((row) => parseStoredTimestamp(requiredText(row.completed_at, 'completed_at')));
}

function toConfigCandidate(
  row: ConfigRow,
  dataDir: string,
): ConfigRow & { readonly detailPath: string } {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    period: row.period,
    interval: row.interval,
    timesPerPeriod: row.timesPerPeriod,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    detailPath: repeatConfigDetailPath(dataDir, row.id),
  };
}

function selectConfigs(db: DatabaseSync, filter: RepeatConfigFilter): ConfigRow[] {
  const enabled = filter.enabled === null ? null : enabledValue(filter.enabled);
  const rows = db
    .prepare(
      `${SELECT_CONFIG}
       WHERE (? IS NULL OR priority = ?)
         AND (? IS NULL OR enabled = ?)`,
    )
    .all(filter.priority, filter.priority, enabled, enabled);
  return rows.map(mapConfigRow);
}

async function loadConfig(
  db: DatabaseSync,
  dataDir: string,
  id: string,
): Promise<RepeatTaskConfig> {
  const row = requireRow(db, id);
  const detailPath = repeatConfigDetailPath(dataDir, id);
  let detail: string;
  try {
    detail = await readTaskDetail(detailPath);
  } catch (error: unknown) {
    throw new AppError('Could not read repeat task config detail.', { cause: error });
  }
  return { ...row, detail, detailPath };
}

async function readConfigDetail(dataDir: string, configId: string): Promise<string> {
  try {
    return await readTaskDetail(repeatConfigDetailPath(dataDir, configId));
  } catch (error: unknown) {
    throw new AppError('Could not read repeat task config detail.', { cause: error });
  }
}

function requireRow(db: DatabaseSync, id: string): ConfigRow {
  const row = db.prepare(`${SELECT_CONFIG} WHERE id = ?`).get(id);
  if (row === undefined) {
    throw new AppError('Repeat task config not found.');
  }
  return mapConfigRow(row);
}

function mapConfigRow(row: Record<string, SQLOutputValue>): ConfigRow {
  return {
    id: requiredText(row.id, 'id'),
    name: requiredText(row.name, 'name'),
    priority: requiredPriority(row.priority),
    period: requiredPeriod(row.period),
    interval: requiredInteger(row.interval, 'interval'),
    timesPerPeriod: requiredInteger(row.times_per_period, 'times_per_period'),
    enabled: requiredEnabled(row.enabled),
    createdAt: requiredText(row.created_at, 'created_at'),
    updatedAt: requiredText(row.updated_at, 'updated_at'),
  };
}

function requiredText(value: SQLOutputValue | undefined, key: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Unexpected ${key} from repeat_task_configs.`);
  }
  return value;
}

function requiredInteger(value: SQLOutputValue | undefined, key: string): number {
  if (typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Unexpected ${key} from repeat_task_configs.`);
  }
  return value;
}

function requiredEnabled(value: SQLOutputValue | undefined): boolean {
  if (value === 1 || value === 1n) {
    return true;
  }
  if (value === 0 || value === 0n) {
    return false;
  }
  throw new Error('Unexpected enabled from repeat_task_configs.');
}

function requiredPriority(value: SQLOutputValue | undefined): TaskPriority {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new Error('Unexpected priority from repeat_task_configs.');
  }
  return value;
}

function requiredPeriod(value: SQLOutputValue | undefined): Period {
  if (value !== 'day' && value !== 'week' && value !== 'month' && value !== 'year') {
    throw new Error('Unexpected period from repeat_task_configs.');
  }
  return value;
}

function enabledValue(enabled: boolean): number {
  return enabled ? 1 : 0;
}

function rollback(db: DatabaseSync): void {
  if (db.isTransaction) {
    db.exec('ROLLBACK');
  }
}

async function withDatabase<T>(dataDir: string, use: (db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = openDatabase(dataDir);
  try {
    return await use(db);
  } finally {
    db.close();
  }
}

async function discardConfigAttachments(dataDir: string, configId: string): Promise<void> {
  try {
    await removeRepeatConfigAttachments(dataDir, configId);
  } catch (error: unknown) {
    if (isMissingAttachmentPath(error)) {
      return;
    }
    throw error;
  }
}

async function discardTaskAttachments(dataDir: string, taskId: string): Promise<void> {
  try {
    await removeTaskAttachments(dataDir, taskId);
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
