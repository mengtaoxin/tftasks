import { AppError } from './errors.ts';
import { readTaskDetail } from './files/attachments.ts';

export type ListSort = 'createdAt' | 'updatedAt' | 'name' | 'priority';
export type ListOrder = 'asc' | 'desc';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_SORT = 'createdAt' satisfies ListSort;
export const DEFAULT_ORDER = 'desc' satisfies ListOrder;

type Sortable = {
  readonly id: string;
  readonly name: string;
  readonly priority: 'low' | 'medium' | 'high';
  readonly createdAt: string;
  readonly updatedAt: string;
};

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 } as const;

export type ListPage<T> = {
  readonly items: T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export function sortAndPage<T extends Sortable>(
  items: readonly T[],
  sort: ListSort,
  order: ListOrder,
  page: number,
  pageSize: number,
): ListPage<T> {
  const sorted = items.toSorted((left, right) => compareItems(left, right, sort, order));
  const start = (page - 1) * pageSize;
  return {
    items: sorted.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

export async function includeByQuery<
  T extends { readonly name: string; readonly detailPath: string },
>(items: readonly T[], query: string | null, readError: string): Promise<T[]> {
  if (query === null || query.length === 0) {
    return [...items];
  }
  const needle = query.toLowerCase();
  const included = await Promise.all(
    items.map(async (item) => {
      if (item.name.toLowerCase().includes(needle)) {
        return true;
      }
      const detail = await readDetail(item.detailPath, readError);
      return detail.toLowerCase().includes(needle);
    }),
  );
  return items.filter((_, index) => included[index] === true);
}

export function parseQuery(value: unknown): string | null {
  if (typeof value !== 'string') {
    throw new AppError('Invalid query.');
  }
  if (value.length === 0) {
    return null;
  }
  return value;
}

export function parsePage(value: unknown): number {
  if (!isWholeNumber(value) || value < 1) {
    throw new AppError('Invalid page.');
  }
  return value;
}

export function parsePageSize(value: unknown): number {
  if (!isWholeNumber(value) || value < 1 || value > 100) {
    throw new AppError('Invalid pageSize.');
  }
  return value;
}

export function parseSort(value: unknown): ListSort {
  if (value !== 'createdAt' && value !== 'updatedAt' && value !== 'name' && value !== 'priority') {
    throw new AppError('Invalid sort.');
  }
  return value;
}

export function parseOrder(value: unknown): ListOrder {
  if (value !== 'asc' && value !== 'desc') {
    throw new AppError('Invalid order.');
  }
  return value;
}

function compareItems(left: Sortable, right: Sortable, sort: ListSort, order: ListOrder): number {
  const primary = primaryCompare(left, right, sort);
  if (primary !== 0) {
    return order === 'asc' ? primary : -primary;
  }
  return compareText(left.id, right.id);
}

function primaryCompare(left: Sortable, right: Sortable, sort: ListSort): number {
  switch (sort) {
    case 'name':
      return compareText(left.name, right.name);
    case 'priority':
      return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    case 'createdAt':
      return compareText(left.createdAt, right.createdAt);
    case 'updatedAt':
      return compareText(left.updatedAt, right.updatedAt);
    default:
      return assertNever(sort);
  }
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

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

async function readDetail(detailPath: string, readError: string): Promise<string> {
  try {
    return await readTaskDetail(detailPath);
  } catch (error: unknown) {
    throw new AppError(readError, { cause: error });
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected: ${String(value)}`);
}
