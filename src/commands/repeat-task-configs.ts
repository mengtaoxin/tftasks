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
import type { Command, CommandHelp, CommandHelpParam } from './types.ts';

const successField: CommandHelpParam = {
  name: 'success',
  required: true,
  description: 'Boolean. True when the command succeeds.',
};

const errorField: CommandHelpParam = {
  name: 'error',
  required: false,
  description: 'Error message when the command fails.',
};

const configFields: readonly CommandHelpParam[] = [
  {
    name: 'config',
    required: true,
    description: 'The repeat task config.',
  },
  {
    name: 'config.id',
    required: true,
    description: 'Repeat task config UUID.',
  },
  {
    name: 'config.name',
    required: true,
    description: 'Non-empty config name.',
  },
  {
    name: 'config.priority',
    required: true,
    description: 'low, medium, or high.',
  },
  {
    name: 'config.period',
    required: true,
    description: 'day, week, month, or year.',
  },
  {
    name: 'config.interval',
    required: true,
    description: 'Integer greater than or equal to 1.',
  },
  {
    name: 'config.timesPerPeriod',
    required: true,
    description: 'Integer greater than or equal to 1.',
  },
  {
    name: 'config.enabled',
    required: true,
    description: 'Boolean.',
  },
  {
    name: 'config.createdAt',
    required: true,
    description: 'ISO-8601 timestamp when the config was created.',
  },
  {
    name: 'config.updatedAt',
    required: true,
    description: 'ISO-8601 timestamp when the config was last updated.',
  },
  {
    name: 'config.detail',
    required: true,
    description: 'Config detail text.',
  },
  {
    name: 'config.detailPath',
    required: true,
    description: 'Absolute path of the config detail file.',
  },
];

const configResponse: readonly CommandHelpParam[] = [successField, ...configFields, errorField];

const idField: CommandHelpParam = {
  name: 'id',
  required: true,
  description: 'Repeat task config UUID.',
};

function configCommandHelp(description: string, request: readonly CommandHelpParam[]): CommandHelp {
  return {
    description,
    params: 'required',
    request,
    response: configResponse,
  };
}

export const repeatTaskConfigCreateCommand: Command = {
  name: 'repeat-task-config:create',
  summary: 'Create a repeat task config',
  help: configCommandHelp('Create a repeat task config with a name, priority, and schedule.', [
    {
      name: 'name',
      required: true,
      description: 'Non-empty string.',
    },
    {
      name: 'priority',
      required: true,
      description: 'low, medium, or high.',
    },
    {
      name: 'period',
      required: true,
      description: 'day, week, month, or year.',
    },
    {
      name: 'interval',
      required: true,
      description: 'Integer greater than or equal to 1.',
    },
    {
      name: 'timesPerPeriod',
      required: true,
      description: 'Integer greater than or equal to 1.',
    },
    {
      name: 'enabled',
      required: true,
      description: 'Boolean.',
    },
    {
      name: 'detail',
      required: false,
      description: 'String. Defaults to empty.',
    },
  ]),
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
  help: configCommandHelp('Read one repeat task config by id.', [idField]),
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
  help: configCommandHelp('Change fields of a repeat task config.', [
    idField,
    {
      name: 'name',
      required: false,
      description: 'Non-empty string.',
    },
    {
      name: 'priority',
      required: false,
      description: 'low, medium, or high.',
    },
    {
      name: 'period',
      required: false,
      description: 'day, week, month, or year.',
    },
    {
      name: 'interval',
      required: false,
      description: 'Integer greater than or equal to 1.',
    },
    {
      name: 'timesPerPeriod',
      required: false,
      description: 'Integer greater than or equal to 1.',
    },
    {
      name: 'enabled',
      required: false,
      description: 'Boolean.',
    },
    {
      name: 'detail',
      required: false,
      description: 'String.',
    },
  ]),
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
  help: {
    description: 'Delete a repeat task config by id.',
    params: 'required',
    request: [idField],
    response: [successField, errorField],
  },
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
  help: {
    description: 'List repeat task configs. Filters and paging are optional.',
    params: 'optional',
    request: [
      {
        name: 'query',
        required: false,
        description: 'String. An empty string does not filter.',
      },
      {
        name: 'priority',
        required: false,
        description: 'low, medium, or high.',
      },
      {
        name: 'enabled',
        required: false,
        description: 'Boolean.',
      },
      {
        name: 'page',
        required: false,
        description: 'Integer greater than or equal to 1. Defaults to 1.',
      },
      {
        name: 'pageSize',
        required: false,
        description: 'Integer from 1 to 100. Defaults to 20.',
      },
      {
        name: 'sort',
        required: false,
        description: 'createdAt, updatedAt, name, or priority. Defaults to createdAt.',
      },
      {
        name: 'order',
        required: false,
        description: 'asc or desc. Defaults to desc.',
      },
    ],
    response: [
      successField,
      {
        name: 'items',
        required: true,
        description: 'Page of repeat task configs.',
      },
      {
        name: 'page',
        required: true,
        description: 'Page number, starting at 1.',
      },
      {
        name: 'pageSize',
        required: true,
        description: 'Maximum number of items on this page.',
      },
      {
        name: 'total',
        required: true,
        description: 'Total number of matching items.',
      },
      {
        name: 'items.id',
        required: true,
        description: 'Repeat task config UUID.',
      },
      {
        name: 'items.name',
        required: true,
        description: 'Non-empty config name.',
      },
      {
        name: 'items.priority',
        required: true,
        description: 'low, medium, or high.',
      },
      {
        name: 'items.period',
        required: true,
        description: 'day, week, month, or year.',
      },
      {
        name: 'items.interval',
        required: true,
        description: 'Integer greater than or equal to 1.',
      },
      {
        name: 'items.timesPerPeriod',
        required: true,
        description: 'Integer greater than or equal to 1.',
      },
      {
        name: 'items.enabled',
        required: true,
        description: 'Boolean.',
      },
      {
        name: 'items.createdAt',
        required: true,
        description: 'ISO-8601 timestamp when the config was created.',
      },
      {
        name: 'items.updatedAt',
        required: true,
        description: 'ISO-8601 timestamp when the config was last updated.',
      },
      errorField,
    ],
  },
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
