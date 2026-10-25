import { jsonSuccess } from '../json-result.ts';
import {
  parseCreateParams,
  parseIdParams,
  parseListParams,
  parseUpdateParams,
} from '../repeat/input.ts';
import {
  createRepeatTaskConfig,
  deleteRepeatTaskConfig,
  listRepeatTaskConfigs,
  readRepeatTaskConfig,
  updateRepeatTaskConfig,
} from '../repeat/repository.ts';
import { runJsonCommand } from './run-json.ts';
import type { Command } from './types.ts';

export const repeatTaskConfigCreateCommand: Command = {
  name: 'repeat-task-config:create',
  summary: 'Create a repeat task config',
  run(context) {
    return runJsonCommand(context, async (params) => {
      const config = await createRepeatTaskConfig(context.dataDir, parseCreateParams(params));
      return jsonSuccess({ config });
    });
  },
};

export const repeatTaskConfigReadCommand: Command = {
  name: 'repeat-task-config:read',
  summary: 'Read a repeat task config',
  run(context) {
    return runJsonCommand(context, async (params) => {
      const config = await readRepeatTaskConfig(context.dataDir, parseIdParams(params));
      return jsonSuccess({ config });
    });
  },
};

export const repeatTaskConfigUpdateCommand: Command = {
  name: 'repeat-task-config:update',
  summary: 'Update a repeat task config',
  run(context) {
    return runJsonCommand(context, async (params) => {
      const config = await updateRepeatTaskConfig(context.dataDir, parseUpdateParams(params));
      return jsonSuccess({ config });
    });
  },
};

export const repeatTaskConfigDeleteCommand: Command = {
  name: 'repeat-task-config:delete',
  summary: 'Delete a repeat task config',
  run(context) {
    return runJsonCommand(context, async (params) => {
      await deleteRepeatTaskConfig(context.dataDir, parseIdParams(params));
      return jsonSuccess({});
    });
  },
};

export const repeatTaskConfigListCommand: Command = {
  name: 'repeat-task-config:list',
  summary: 'List repeat task configs',
  run(context) {
    return runJsonCommand(
      context,
      async (params) => {
        const page = await listRepeatTaskConfigs(context.dataDir, parseListParams(params));
        return jsonSuccess(page);
      },
      { paramsRequired: false },
    );
  },
};
