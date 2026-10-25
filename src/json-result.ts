import type { CommandResult } from './commands/types.ts';

export function jsonSuccess(fields: Readonly<Record<string, unknown>>): CommandResult {
  return jsonResult(0, { success: true, ...fields });
}

export function jsonFailure(error: string): CommandResult {
  return jsonResult(1, { success: false, error });
}

function jsonResult(exitCode: number, value: unknown): CommandResult {
  return {
    exitCode,
    stdout: `${JSON.stringify(value, null, 2)}\n`,
    stderr: '',
  };
}
