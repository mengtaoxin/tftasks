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
import type { TaskListQuery } from './list.ts';
import type { CreateTaskInput, UpdateTaskInput } from './repository.ts';
import type { TaskPriority } from './rules.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CREATE_FIELDS = ['name', 'priority', 'detail', 'parentId'] as const;
const UPDATE_FIELDS = ['id', 'name', 'detail', 'priority', 'parentId'] as const;
const ID_FIELDS = ['id'] as const;
const FINISH_FIELDS = ['kind', 'id'] as const;
const LIST_FIELDS = [
  'status',
  'query',
  'priority',
  'parentId',
  'page',
  'pageSize',
  'sort',
  'order',
] as const;

export type FinishRequest =
  | { readonly kind: 'task'; readonly id: string }
  | { readonly kind: 'repeat-task-config'; readonly id: string };

export function parseCreateParams(params: Record<string, unknown>): CreateTaskInput {
  assertAllowed(params, CREATE_FIELDS);
  if (!('name' in params)) {
    throw new AppError('Missing field: name.');
  }
  if (!('priority' in params)) {
    throw new AppError('Missing field: priority.');
  }
  return {
    name: parseName(params.name),
    priority: parsePriority(params.priority),
    detail: 'detail' in params ? parseDetail(params.detail) : '',
    parentId: 'parentId' in params ? parseParentId(params.parentId) : null,
  };
}

export function parseUpdateParams(params: Record<string, unknown>): UpdateTaskInput {
  assertAllowed(params, UPDATE_FIELDS);
  const input: {
    id: string;
    name?: string;
    priority?: TaskPriority;
    detail?: string;
    parentId?: string | null;
  } = { id: requireId(params) };
  if ('name' in params) {
    input.name = parseName(params.name);
  }
  if ('detail' in params) {
    input.detail = parseDetail(params.detail);
  }
  if ('priority' in params) {
    input.priority = parsePriority(params.priority);
  }
  if ('parentId' in params) {
    input.parentId = parseParentId(params.parentId);
  }
  return input;
}

export function parseIdParams(params: Record<string, unknown>): string {
  assertAllowed(params, ID_FIELDS);
  return requireId(params);
}

export function parseFinishParams(params: Record<string, unknown>): FinishRequest {
  assertAllowed(params, FINISH_FIELDS);
  if (!('kind' in params)) {
    throw new AppError('Missing field: kind.');
  }
  if (!('id' in params)) {
    throw new AppError('Missing field: id.');
  }
  if (params.kind !== 'task' && params.kind !== 'repeat-task-config') {
    throw new AppError('Invalid kind.');
  }
  return { kind: params.kind, id: parseId(params.id) };
}

export function parseTaskListParams(params: Record<string, unknown>): TaskListQuery {
  assertAllowed(params, LIST_FIELDS);
  return {
    status: 'status' in params ? parseStatus(params.status) : 'incomplete',
    query: 'query' in params ? parseQuery(params.query) : null,
    priority: 'priority' in params ? parsePriority(params.priority) : null,
    parentId: 'parentId' in params ? parseParentId(params.parentId) : null,
    restrictParent: 'parentId' in params,
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

function parseDetail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError('Invalid detail.');
  }
  return value;
}

function parseStatus(value: unknown): TaskListQuery['status'] {
  if (value !== 'incomplete' && value !== 'complete' && value !== 'all') {
    throw new AppError('Invalid status.');
  }
  return value;
}

function parseParentId(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new AppError('Invalid parentId.');
  }
  return value;
}
