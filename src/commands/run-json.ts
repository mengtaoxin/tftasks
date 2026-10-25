import { AppError } from '../errors.ts';
import { jsonFailure } from '../json-result.ts';
import { readParams } from '../params.ts';
import type { CommandContext, CommandResult } from './types.ts';

export async function runJsonCommand(
  context: CommandContext,
  handle: (params: Record<string, unknown>) => Promise<CommandResult>,
  options?: { readonly paramsRequired?: boolean },
): Promise<CommandResult> {
  try {
    const parsed = await readParams(context.args, {
      dataDir: context.dataDir,
      required: options?.paramsRequired ?? true,
    });
    if (!parsed.ok) {
      return jsonFailure(parsed.error);
    }
    return await handle(parsed.params);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return jsonFailure(error.message);
    }
    throw error;
  }
}
