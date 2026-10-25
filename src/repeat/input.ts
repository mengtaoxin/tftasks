import { AppError } from '../errors.ts';
import {
  DEFAULT_ORDER,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  parseOrder,
  parsePage,
  parsePageSize,
  parseQuery,
  parseSort,
} from '../listing.ts';
import type { TaskPriority } from '../tasks/rules.ts';
import type {
  CreateRepeatConfigInput,
  RepeatConfigListQuery,
  UpdateRepeatConfigInput,
} from './repository.ts';
import type { Period } from './schedule.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CREATE_FIELDS = [
  'name',
  'priority',
  'period',
  'interval',
  'timesPerPeriod',
  'enabled',
  'detail',
] as const;
const UPDATE_FIELDS = [
  'id',
  'name',
  'priority',
  'period',
  'interval',
  'timesPerPeriod',
  'enabled',
  'detail',
] as const;
const ID_FIELDS = ['id'] as const;
const LIST_FIELDS = ['query', 'priority', 'enabled', 'page', 'pageSize', 'sort', 'order'] as const;

export function parseCreateParams(params: Record<string, unknown>): CreateRepeatConfigInput {
  assertAllowed(params, CREATE_FIELDS);
  requireField(params, 'name');
  requireField(params, 'priority');
  requireField(params, 'period');
  requireField(params, 'interval');
  requireField(params, 'timesPerPeriod');
  requireField(params, 'enabled');
  return {
    name: parseName(params.name),
    priority: parsePriority(params.priority),
    period: parsePeriod(params.period),
    interval: parsePositiveInt(params.interval, 'interval'),
    timesPerPeriod: parsePositiveInt(params.timesPerPeriod, 'timesPerPeriod'),
    enabled: parseEnabled(params.enabled),
    detail: 'detail' in params ? parseDetail(params.detail) : '',
  };
}

export function parseUpdateParams(params: Record<string, unknown>): UpdateRepeatConfigInput {
  assertAllowed(params, UPDATE_FIELDS);
  const input: {
    id: string;
    name?: string;
    priority?: TaskPriority;
    period?: Period;
    interval?: number;
    timesPerPeriod?: number;
    enabled?: boolean;
    detail?: string;
  } = { id: requireId(params) };
  if ('name' in params) {
    input.name = parseName(params.name);
  }
  if ('priority' in params) {
    input.priority = parsePriority(params.priority);
  }
  if ('period' in params) {
    input.period = parsePeriod(params.period);
  }
  if ('interval' in params) {
    input.interval = parsePositiveInt(params.interval, 'interval');
  }
  if ('timesPerPeriod' in params) {
    input.timesPerPeriod = parsePositiveInt(params.timesPerPeriod, 'timesPerPeriod');
  }
  if ('enabled' in params) {
    input.enabled = parseEnabled(params.enabled);
  }
  if ('detail' in params) {
    input.detail = parseDetail(params.detail);
  }
  return input;
}

export function parseIdParams(params: Record<string, unknown>): string {
  assertAllowed(params, ID_FIELDS);
  return requireId(params);
}

export function parseListParams(params: Record<string, unknown>): RepeatConfigListQuery {
  assertAllowed(params, LIST_FIELDS);
  return {
    query: 'query' in params ? parseQuery(params.query) : null,
    priority: 'priority' in params ? parsePriority(params.priority) : null,
    enabled: 'enabled' in params ? parseEnabled(params.enabled) : null,
    page: 'page' in params ? parsePage(params.page) : DEFAULT_PAGE,
    pageSize: 'pageSize' in params ? parsePageSize(params.pageSize) : DEFAULT_PAGE_SIZE,
    sort: 'sort' in params ? parseSort(params.sort) : DEFAULT_SORT,
    order: 'order' in params ? parseOrder(params.order) : DEFAULT_ORDER,
  };
}

function assertAllowed(params: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(params)) {
    if (!allowed.includes(key)) {
      throw new AppError(`Unknown field: ${key}.`);
    }
  }
}

function requireField(params: Record<string, unknown>, field: string): void {
  if (!(field in params)) {
    throw new AppError(`Missing field: ${field}.`);
  }
}

function requireId(params: Record<string, unknown>): string {
  if (!('id' in params)) {
    throw new AppError('Missing field: id.');
  }
  return parseId(params.id);
}

function parseId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new AppError('Invalid id.');
  }
  return value;
}

function parseName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('Invalid name.');
  }
  return value;
}

function parsePriority(value: unknown): TaskPriority {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new AppError('Invalid priority.');
  }
  return value;
}

function parsePeriod(value: unknown): Period {
  if (value !== 'day' && value !== 'week' && value !== 'month' && value !== 'year') {
    throw new AppError('Invalid period.');
  }
  return value;
}

function parsePositiveInt(value: unknown, field: 'interval' | 'timesPerPeriod'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new AppError(`Invalid ${field}.`);
  }
  return value;
}

function parseEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new AppError('Invalid enabled.');
  }
  return value;
}

function parseDetail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError('Invalid detail.');
  }
  return value;
}
