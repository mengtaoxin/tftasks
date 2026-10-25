import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { openDatabase } from '../db/open.ts';
import { taskDetailPath } from '../files/attachments.ts';
import { includeByQuery, sortAndPage, type ListOrder, type ListSort } from '../listing.ts';
import { loadRepeatConfigSummaries, type RepeatConfigSummary } from '../repeat/repository.ts';
import { assessSchedule, parseStoredTimestamp, type Period } from '../repeat/schedule.ts';
import type { TaskPriority, TaskStatus } from './rules.ts';

export type TaskListQuery = {
  readonly status: 'incomplete' | 'complete' | 'all';
  readonly query: string | null;
  readonly priority: TaskPriority | null;
  readonly parentId: string | null;
  readonly restrictParent: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: ListSort;
  readonly order: ListOrder;
};

export type TaskListItem = {
  readonly kind: 'task';
  readonly id: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly parentId: string | null;
  readonly priority: TaskPriority;
  readonly repeatTaskConfigId: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RepeatConfigListItem = {
  readonly kind: 'repeat-task-config';
  readonly id: string;
  readonly name: string;
  readonly priority: TaskPriority;
  readonly period: Period;
  readonly interval: number;
  readonly timesPerPeriod: number;
  readonly enabled: boolean;
  readonly remaining: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type ListedItem = TaskListItem | RepeatConfigListItem;

type TaskCandidate = TaskListItem & { readonly detailPath: string };

export async function listTasks(
  dataDir: string,
  query: TaskListQuery,
  now: Date,
): Promise<{
  items: ListedItem[];
  page: number;
  pageSize: number;
  total: number;
}> {
  return withDatabase(dataDir, async (db) => {
    const tasks = await loadTaskItems(db, dataDir, query);
    const configs =
      query.restrictParent || query.status === 'complete'
        ? []
        : await loadConfigItems(db, dataDir, query, now);
    return sortAndPage([...tasks, ...configs], query.sort, query.order, query.page, query.pageSize);
  });
}

async function loadTaskItems(
  db: DatabaseSync,
  dataDir: string,
  query: TaskListQuery,
): Promise<TaskListItem[]> {
  const status = query.status === 'all' ? null : query.status;
  const restrict = query.restrictParent ? 1 : 0;
  const rows = db
    .prepare(
      `SELECT id, name, status, parent_id, priority, repeat_task_config_id,
        completed_at, created_at, updated_at
       FROM tasks
       WHERE (? IS NULL OR status = ?)
         AND (? IS NULL OR priority = ?)
         AND (? = 0 OR parent_id IS ?)`,
    )
    .all(status, status, query.priority, query.priority, restrict, query.parentId);
  const candidates = rows.map((row) => toTaskCandidate(row, dataDir));
  const matched = await includeByQuery(candidates, query.query, 'Could not read task detail.');
  return matched.map((item) => ({
    kind: item.kind,
    id: item.id,
    name: item.name,
    status: item.status,
    parentId: item.parentId,
    priority: item.priority,
    repeatTaskConfigId: item.repeatTaskConfigId,
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

async function loadConfigItems(
  db: DatabaseSync,
  dataDir: string,
  query: TaskListQuery,
  now: Date,
): Promise<RepeatConfigListItem[]> {
  const configs = await loadRepeatConfigSummaries(db, dataDir, {
    priority: query.priority,
    enabled: query.status === 'incomplete' ? true : null,
    query: query.query,
  });
  const completions = loadCompletionsByConfig(db);
  const items: RepeatConfigListItem[] = [];
  for (const config of configs) {
    const schedule = assessSchedule({
      createdAt: parseStoredTimestamp(config.createdAt),
      period: config.period,
      interval: config.interval,
      timesPerPeriod: config.timesPerPeriod,
      completedAt: completions.get(config.id) ?? [],
      now,
    });
    if (query.status === 'incomplete' && (!schedule.active || schedule.remaining <= 0)) {
      continue;
    }
    items.push(toConfigItem(config, schedule.active ? schedule.remaining : 0));
  }
  return items;
}

function loadCompletionsByConfig(db: DatabaseSync): Map<string, Date[]> {
  const rows = db
    .prepare(
      `SELECT repeat_task_config_id, completed_at
       FROM tasks
       WHERE status = 'complete'
         AND repeat_task_config_id IS NOT NULL
         AND completed_at IS NOT NULL`,
    )
    .all();
  const grouped = new Map<string, Date[]>();
  for (const row of rows) {
    const configId = requiredText(row.repeat_task_config_id, 'repeat_task_config_id');
    const completedAt = parseStoredTimestamp(requiredText(row.completed_at, 'completed_at'));
    const existing = grouped.get(configId);
    if (existing === undefined) {
      grouped.set(configId, [completedAt]);
    } else {
      existing.push(completedAt);
    }
  }
  return grouped;
}

function toConfigItem(config: RepeatConfigSummary, remaining: number): RepeatConfigListItem {
  return {
    kind: 'repeat-task-config',
    id: config.id,
    name: config.name,
    priority: config.priority,
    period: config.period,
    interval: config.interval,
    timesPerPeriod: config.timesPerPeriod,
    enabled: config.enabled,
    remaining,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function toTaskCandidate(row: Record<string, SQLOutputValue>, dataDir: string): TaskCandidate {
  const item = mapTaskItem(row);
  return {
    kind: item.kind,
    id: item.id,
    name: item.name,
    status: item.status,
    parentId: item.parentId,
    priority: item.priority,
    repeatTaskConfigId: item.repeatTaskConfigId,
    completedAt: item.completedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    detailPath: taskDetailPath(dataDir, item.id),
  };
}

function mapTaskItem(row: Record<string, SQLOutputValue>): TaskListItem {
  return {
    kind: 'task',
    id: requiredText(row.id, 'id'),
    name: requiredText(row.name, 'name'),
    status: requiredStatus(row.status),
    parentId: nullableText(row.parent_id, 'parent_id'),
    priority: requiredPriority(row.priority),
    repeatTaskConfigId: nullableText(row.repeat_task_config_id, 'repeat_task_config_id'),
    completedAt: nullableText(row.completed_at, 'completed_at'),
    createdAt: requiredText(row.created_at, 'created_at'),
    updatedAt: requiredText(row.updated_at, 'updated_at'),
  };
}

function requiredText(value: SQLOutputValue | undefined, key: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Unexpected ${key} from tasks.`);
  }
  return value;
}

function nullableText(value: SQLOutputValue | undefined, key: string): string | null {
  if (value === null) {
    return null;
  }
  return requiredText(value, key);
}

function requiredStatus(value: SQLOutputValue | undefined): TaskStatus {
  if (value !== 'incomplete' && value !== 'complete') {
    throw new Error('Unexpected status from tasks.');
  }
  return value;
}

function requiredPriority(value: SQLOutputValue | undefined): TaskPriority {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new Error('Unexpected priority from tasks.');
  }
  return value;
}

async function withDatabase<T>(dataDir: string, use: (db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = openDatabase(dataDir);
  try {
    return await use(db);
  } finally {
    db.close();
  }
}
