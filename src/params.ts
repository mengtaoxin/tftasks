import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type ReadParamsOptions = {
  dataDir: string;
  required?: boolean;
};

export type ReadParamsResult =
  | { ok: true; params: Record<string, unknown> }
  | { ok: false; error: string };

const USE_EITHER = 'Use either --params or --params-file.';
const MISSING_PARAMS = 'Missing --params or --params-file.';
const INVALID_JSON = 'Params are not valid JSON.';
const NOT_OBJECT = 'Params must be a JSON object.';

type FlagSource = { kind: 'inline'; raw: string } | { kind: 'file'; filePath: string };

type ParsedArgs = { ok: true; source: FlagSource | undefined } | { ok: false; error: string };

export async function readParams(
  args: readonly string[],
  options: ReadParamsOptions,
): Promise<ReadParamsResult> {
  const parsed = parseArgs(args);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.source === undefined) {
    if (options.required === false) {
      return { ok: true, params: {} };
    }
    return { ok: false, error: MISSING_PARAMS };
  }

  if (parsed.source.kind === 'inline') {
    return parseJsonObject(parsed.source.raw);
  }

  const filePath = resolveParamsFile(parsed.source.filePath, options.dataDir);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return {
      ok: false,
      error: `Cannot read params file: ${parsed.source.filePath}`,
    };
  }
  return parseJsonObject(raw);
}

function parseArgs(args: readonly string[]): ParsedArgs {
  let source: FlagSource | undefined;
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === undefined) {
      index += 1;
      continue;
    }

    if (arg === '--params' || arg === '--params-file') {
      if (source !== undefined) {
        return { ok: false, error: USE_EITHER };
      }
      const value = args[index + 1];
      if (value === undefined) {
        return { ok: false, error: `Missing value for ${arg}.` };
      }
      source =
        arg === '--params' ? { kind: 'inline', raw: value } : { kind: 'file', filePath: value };
      index += 2;
      continue;
    }

    return { ok: false, error: `Unexpected argument: ${arg}` };
  }

  return { ok: true, source };
}

function resolveParamsFile(filePath: string, dataDir: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(dataDir, filePath);
}

function parseJsonObject(raw: string): ReadParamsResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: INVALID_JSON };
  }
  if (!isPlainObject(value)) {
    return { ok: false, error: NOT_OBJECT };
  }
  return { ok: true, params: value };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
