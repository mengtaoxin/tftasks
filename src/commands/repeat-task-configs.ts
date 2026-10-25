import {
  booleanTrueWhenSucceeds,
  booleanValue,
  errorMessageWhenFails,
  integerGte1,
  nonEmptyString,
  orderDefaultsDesc,
  pageDefaults1,
  pageNumberFrom1,
  pageSizeDefaults20,
  pageSizeMaxItems,
  periodChoices,
  priorityChoices,
  queryEmptyNoFilter,
  repeatConfigUuid,
  sortDefaultsCreatedAt,
  stringDefaultsEmpty,
  stringValue,
  totalMatchingItems,
} from '../i18n/common.ts';
import { jsonSuccess } from '../json-result.ts';
import type { Localized } from '../lang.ts';
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
  description: booleanTrueWhenSucceeds,
};

const errorField: CommandHelpParam = {
  name: 'error',
  required: false,
  description: errorMessageWhenFails,
};

const nonEmptyConfigName: Localized = {
  en: 'Non-empty config name.',
  zh: '非空配置名称。',
};

const createdAtDescription: Localized = {
  en: 'ISO-8601 timestamp when the config was created.',
  zh: '配置创建时的 ISO-8601 时间戳。',
};

const updatedAtDescription: Localized = {
  en: 'ISO-8601 timestamp when the config was last updated.',
  zh: '配置最近更新时的 ISO-8601 时间戳。',
};

const configFields: readonly CommandHelpParam[] = [
  {
    name: 'config',
    required: true,
    description: {
      en: 'The repeat task config.',
      zh: '重复任务配置。',
    },
  },
  {
    name: 'config.id',
    required: true,
    description: repeatConfigUuid,
  },
  {
    name: 'config.name',
    required: true,
    description: nonEmptyConfigName,
  },
  {
    name: 'config.priority',
    required: true,
    description: priorityChoices,
  },
  {
    name: 'config.period',
    required: true,
    description: periodChoices,
  },
  {
    name: 'config.interval',
    required: true,
    description: integerGte1,
  },
  {
    name: 'config.timesPerPeriod',
    required: true,
    description: integerGte1,
  },
  {
    name: 'config.enabled',
    required: true,
    description: booleanValue,
  },
  {
    name: 'config.createdAt',
    required: true,
    description: createdAtDescription,
  },
  {
    name: 'config.updatedAt',
    required: true,
    description: updatedAtDescription,
  },
  {
    name: 'config.detail',
    required: true,
    description: {
      en: 'Config detail text.',
      zh: '配置详情文本。',
    },
  },
  {
    name: 'config.detailPath',
    required: true,
    description: {
      en: 'Absolute path of the config detail file.',
      zh: '配置详情文件的绝对路径。',
    },
  },
];

const configResponse: readonly CommandHelpParam[] = [successField, ...configFields, errorField];

const idField: CommandHelpParam = {
  name: 'id',
  required: true,
  description: repeatConfigUuid,
};

function configCommandHelp(
  description: Localized,
  request: readonly CommandHelpParam[],
): CommandHelp {
  return {
    description,
    params: 'required',
    request,
    response: configResponse,
  };
}

export const repeatTaskConfigCreateCommand: Command = {
  name: 'repeat-task-config:create',
  summary: {
    en: 'Create a repeat task config',
    zh: '创建重复任务配置',
  },
  help: configCommandHelp(
    {
      en: 'Create a repeat task config with a name, priority, and schedule.',
      zh: '按名称、优先级与周期创建重复任务配置。',
    },
    [
      {
        name: 'name',
        required: true,
        description: nonEmptyString,
      },
      {
        name: 'priority',
        required: true,
        description: priorityChoices,
      },
      {
        name: 'period',
        required: true,
        description: periodChoices,
      },
      {
        name: 'interval',
        required: true,
        description: integerGte1,
      },
      {
        name: 'timesPerPeriod',
        required: true,
        description: integerGte1,
      },
      {
        name: 'enabled',
        required: true,
        description: booleanValue,
      },
      {
        name: 'detail',
        required: false,
        description: stringDefaultsEmpty,
      },
    ],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const config = await createRepeatTaskConfig(context.dataDir, parseCreateParams(params));
      return jsonSuccess({ config });
    });
  },
};

export const repeatTaskConfigReadCommand: Command = {
  name: 'repeat-task-config:read',
  summary: {
    en: 'Read a repeat task config',
    zh: '读取重复任务配置',
  },
  help: configCommandHelp(
    {
      en: 'Read one repeat task config by id.',
      zh: '按 id 读取一个重复任务配置。',
    },
    [idField],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const config = await readRepeatTaskConfig(context.dataDir, parseIdParams(params));
      return jsonSuccess({ config });
    });
  },
};

export const repeatTaskConfigUpdateCommand: Command = {
  name: 'repeat-task-config:update',
  summary: {
    en: 'Update a repeat task config',
    zh: '更新重复任务配置',
  },
  help: configCommandHelp(
    {
      en: 'Change fields of a repeat task config.',
      zh: '修改重复任务配置的字段。',
    },
    [
      idField,
      {
        name: 'name',
        required: false,
        description: nonEmptyString,
      },
      {
        name: 'priority',
        required: false,
        description: priorityChoices,
      },
      {
        name: 'period',
        required: false,
        description: periodChoices,
      },
      {
        name: 'interval',
        required: false,
        description: integerGte1,
      },
      {
        name: 'timesPerPeriod',
        required: false,
        description: integerGte1,
      },
      {
        name: 'enabled',
        required: false,
        description: booleanValue,
      },
      {
        name: 'detail',
        required: false,
        description: stringValue,
      },
    ],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const config = await updateRepeatTaskConfig(context.dataDir, parseUpdateParams(params));
      return jsonSuccess({ config });
    });
  },
};

export const repeatTaskConfigDeleteCommand: Command = {
  name: 'repeat-task-config:delete',
  summary: {
    en: 'Delete a repeat task config',
    zh: '删除重复任务配置',
  },
  help: {
    description: {
      en: 'Delete a repeat task config by id.',
      zh: '按 id 删除重复任务配置。',
    },
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
  summary: {
    en: 'List repeat task configs',
    zh: '列出重复任务配置',
  },
  help: {
    description: {
      en: 'List repeat task configs. Filters and paging are optional.',
      zh: '列出重复任务配置。筛选与分页可选。',
    },
    params: 'optional',
    request: [
      {
        name: 'query',
        required: false,
        description: queryEmptyNoFilter,
      },
      {
        name: 'priority',
        required: false,
        description: priorityChoices,
      },
      {
        name: 'enabled',
        required: false,
        description: booleanValue,
      },
      {
        name: 'page',
        required: false,
        description: pageDefaults1,
      },
      {
        name: 'pageSize',
        required: false,
        description: pageSizeDefaults20,
      },
      {
        name: 'sort',
        required: false,
        description: sortDefaultsCreatedAt,
      },
      {
        name: 'order',
        required: false,
        description: orderDefaultsDesc,
      },
    ],
    response: [
      successField,
      {
        name: 'items',
        required: true,
        description: {
          en: 'Page of repeat task configs.',
          zh: '本页的重复任务配置。',
        },
      },
      {
        name: 'page',
        required: true,
        description: pageNumberFrom1,
      },
      {
        name: 'pageSize',
        required: true,
        description: pageSizeMaxItems,
      },
      {
        name: 'total',
        required: true,
        description: totalMatchingItems,
      },
      {
        name: 'items.id',
        required: true,
        description: repeatConfigUuid,
      },
      {
        name: 'items.name',
        required: true,
        description: nonEmptyConfigName,
      },
      {
        name: 'items.priority',
        required: true,
        description: priorityChoices,
      },
      {
        name: 'items.period',
        required: true,
        description: periodChoices,
      },
      {
        name: 'items.interval',
        required: true,
        description: integerGte1,
      },
      {
        name: 'items.timesPerPeriod',
        required: true,
        description: integerGte1,
      },
      {
        name: 'items.enabled',
        required: true,
        description: booleanValue,
      },
      {
        name: 'items.createdAt',
        required: true,
        description: createdAtDescription,
      },
      {
        name: 'items.updatedAt',
        required: true,
        description: updatedAtDescription,
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
