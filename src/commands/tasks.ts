import {
  booleanTrueWhenSucceeds,
  booleanValue,
  errorMessageWhenFails,
  integerGte1,
  joinSentence,
  nonEmptyString,
  onTaskAndRepeatConfig,
  orderDefaultsDesc,
  pageDefaults1,
  pageNumberFrom1,
  pageSizeDefaults20,
  pageSizeMaxItems,
  periodChoices,
  priorityChoices,
  queryEmptyNoFilter,
  sortDefaultsCreatedAt,
  stringDefaultsEmpty,
  stringValue,
  taskUuid,
  totalMatchingItems,
  whenKindIsRepeatConfig,
  whenKindIsTask,
} from '../i18n/common.ts';
import { jsonSuccess } from '../json-result.ts';
import type { Localized } from '../lang.ts';
import { finishRepeatTaskConfig } from '../repeat/repository.ts';
import {
  parseCreateParams,
  parseFinishParams,
  parseIdParams,
  parseTaskListParams,
  parseUpdateParams,
} from '../tasks/input.ts';
import { listTasks } from '../tasks/list.ts';
import { createTask, deleteTask, finishTask, readTask, updateTask } from '../tasks/repository.ts';
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

const incompleteOrComplete: Localized = {
  en: 'incomplete or complete.',
  zh: 'incomplete 或 complete。',
};

const taskFields: readonly CommandHelpParam[] = [
  {
    name: 'task',
    required: true,
    description: {
      en: 'The task.',
      zh: '任务。',
    },
  },
  {
    name: 'task.id',
    required: true,
    description: taskUuid,
  },
  {
    name: 'task.name',
    required: true,
    description: {
      en: 'Non-empty task name.',
      zh: '非空任务名称。',
    },
  },
  {
    name: 'task.status',
    required: true,
    description: incompleteOrComplete,
  },
  {
    name: 'task.parentId',
    required: true,
    description: {
      en: 'Parent task UUID, or null.',
      zh: '父任务 UUID，或 null。',
    },
  },
  {
    name: 'task.priority',
    required: true,
    description: priorityChoices,
  },
  {
    name: 'task.repeatTaskConfigId',
    required: true,
    description: {
      en: 'Repeat task config UUID, or null.',
      zh: '重复任务配置 UUID，或 null。',
    },
  },
  {
    name: 'task.startsAt',
    required: true,
    description: {
      en: 'ISO-8601 timestamp at the local start of the start date, or null.',
      zh: '开始日本地起始时刻的 ISO-8601 时间戳，或 null。',
    },
  },
  {
    name: 'task.endsAt',
    required: true,
    description: {
      en: 'ISO-8601 timestamp at the local end of the end date, or null.',
      zh: '结束日本地结束时刻的 ISO-8601 时间戳，或 null。',
    },
  },
  {
    name: 'task.completedAt',
    required: true,
    description: {
      en: 'ISO-8601 timestamp when the task was actually finished, or null.',
      zh: '任务实际完成时的 ISO-8601 时间戳，或 null。',
    },
  },
  {
    name: 'task.createdAt',
    required: true,
    description: {
      en: 'ISO-8601 timestamp when the task was created.',
      zh: '任务创建时的 ISO-8601 时间戳。',
    },
  },
  {
    name: 'task.updatedAt',
    required: true,
    description: {
      en: 'ISO-8601 timestamp when the task was last updated.',
      zh: '任务最近更新时的 ISO-8601 时间戳。',
    },
  },
  {
    name: 'task.detail',
    required: true,
    description: {
      en: 'Task detail text.',
      zh: '任务详情文本。',
    },
  },
  {
    name: 'task.detailPath',
    required: true,
    description: {
      en: 'Absolute path of the task detail file.',
      zh: '任务详情文件的绝对路径。',
    },
  },
];

const taskResponse: readonly CommandHelpParam[] = [successField, ...taskFields, errorField];

function taskCommandHelp(
  description: Localized,
  request: readonly CommandHelpParam[],
): CommandHelp {
  return {
    description,
    params: 'required',
    request,
    response: taskResponse,
  };
}

const idLead: Localized = {
  en: 'Id.',
  zh: '标识。',
};

const nameLead: Localized = {
  en: 'Name.',
  zh: '名称。',
};

const creationTimeLead: Localized = {
  en: 'ISO-8601 creation time.',
  zh: 'ISO-8601 创建时间。',
};

const updateTimeLead: Localized = {
  en: 'ISO-8601 update time.',
  zh: 'ISO-8601 更新时间。',
};

export const taskCreateCommand: Command = {
  name: 'task:create',
  summary: {
    en: 'Create a task',
    zh: '创建任务',
  },
  help: taskCommandHelp(
    {
      en: 'Create a task with a name and priority.',
      zh: '按名称与优先级创建任务。',
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
        name: 'detail',
        required: false,
        description: stringDefaultsEmpty,
      },
      {
        name: 'parentId',
        required: false,
        description: {
          en: 'Task UUID or null. Defaults to null.',
          zh: '任务 UUID 或 null。默认为 null。',
        },
      },
      {
        name: 'startsAt',
        required: false,
        description: {
          en: 'YYYY-MM-DD or an ISO-8601 timestamp. Stored as the local start of that day. Defaults to null.',
          zh: 'YYYY-MM-DD 或 ISO-8601 时间戳。按该日本地起始时刻存储。默认为 null。',
        },
      },
      {
        name: 'endsAt',
        required: false,
        description: {
          en: 'YYYY-MM-DD or an ISO-8601 timestamp. Stored as the local end of that day. Defaults to null.',
          zh: 'YYYY-MM-DD 或 ISO-8601 时间戳。按该日本地结束时刻存储。默认为 null。',
        },
      },
    ],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const task = await createTask(context.dataDir, parseCreateParams(params));
      return jsonSuccess({ task });
    });
  },
};

export const taskReadCommand: Command = {
  name: 'task:read',
  summary: {
    en: 'Read a task',
    zh: '读取任务',
  },
  help: taskCommandHelp(
    {
      en: 'Read one task by id.',
      zh: '按 id 读取一个任务。',
    },
    [
      {
        name: 'id',
        required: true,
        description: taskUuid,
      },
    ],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const task = await readTask(context.dataDir, parseIdParams(params));
      return jsonSuccess({ task });
    });
  },
};

export const taskUpdateCommand: Command = {
  name: 'task:update',
  summary: {
    en: 'Update a task',
    zh: '更新任务',
  },
  help: taskCommandHelp(
    {
      en: 'Change the name, detail, priority, parent, start date, or end date of an incomplete task.',
      zh: '修改未完成任务的名称、详情、优先级、父任务、开始日期或结束日期。',
    },
    [
      {
        name: 'id',
        required: true,
        description: taskUuid,
      },
      {
        name: 'name',
        required: false,
        description: nonEmptyString,
      },
      {
        name: 'detail',
        required: false,
        description: stringValue,
      },
      {
        name: 'priority',
        required: false,
        description: priorityChoices,
      },
      {
        name: 'parentId',
        required: false,
        description: {
          en: 'Task UUID or null.',
          zh: '任务 UUID 或 null。',
        },
      },
      {
        name: 'startsAt',
        required: false,
        description: {
          en: 'YYYY-MM-DD, an ISO-8601 timestamp, or null. Stored as the local start of that day. Null clears it.',
          zh: 'YYYY-MM-DD、ISO-8601 时间戳或 null。按该日本地起始时刻存储。null 表示清除。',
        },
      },
      {
        name: 'endsAt',
        required: false,
        description: {
          en: 'YYYY-MM-DD, an ISO-8601 timestamp, or null. Stored as the local end of that day. Null clears it.',
          zh: 'YYYY-MM-DD、ISO-8601 时间戳或 null。按该日本地结束时刻存储。null 表示清除。',
        },
      },
    ],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const task = await updateTask(context.dataDir, parseUpdateParams(params));
      return jsonSuccess({ task });
    });
  },
};

export const taskDeleteCommand: Command = {
  name: 'task:delete',
  summary: {
    en: 'Delete a task',
    zh: '删除任务',
  },
  help: {
    description: {
      en: 'Delete a task by id.',
      zh: '按 id 删除任务。',
    },
    params: 'required',
    request: [
      {
        name: 'id',
        required: true,
        description: taskUuid,
      },
    ],
    response: [successField, errorField],
  },
  run(context) {
    return runJsonCommand(context, async (params) => {
      await deleteTask(context.dataDir, parseIdParams(params));
      return jsonSuccess({});
    });
  },
};

export const taskFinishCommand: Command = {
  name: 'task:finish',
  summary: {
    en: 'Finish a task',
    zh: '完成任务',
  },
  help: taskCommandHelp(
    {
      en: 'Finish a task or a repeat task config. Both kinds return the completed task.',
      zh: '完成任务或重复任务配置。两种类型都返回已完成的任务。',
    },
    [
      {
        name: 'kind',
        required: true,
        description: {
          en: 'task or repeat-task-config.',
          zh: 'task 或 repeat-task-config。',
        },
      },
      {
        name: 'id',
        required: true,
        description: {
          en: 'UUID of the task or repeat task config.',
          zh: '任务或重复任务配置的 UUID。',
        },
      },
    ],
  ),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const request = parseFinishParams(params);
      const task =
        request.kind === 'task'
          ? await finishTask(context.dataDir, request.id)
          : await finishRepeatTaskConfig(context.dataDir, request.id);
      return jsonSuccess({ task });
    });
  },
};

export const taskListCommand: Command = {
  name: 'task:list',
  summary: {
    en: 'List tasks',
    zh: '列出任务',
  },
  help: {
    description: {
      en: 'List tasks and repeat task configs. Filters and paging are optional.',
      zh: '列出任务与重复任务配置。筛选与分页可选。',
    },
    params: 'optional',
    request: [
      {
        name: 'status',
        required: false,
        description: {
          en: 'incomplete, complete, or all. Defaults to incomplete.',
          zh: 'incomplete、complete 或 all。默认为 incomplete。',
        },
      },
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
        name: 'parentId',
        required: false,
        description: {
          en: 'Task UUID or null. When set, only tasks with that parent are included; null means no parent.',
          zh: '任务 UUID 或 null。设置后只包含该父任务下的任务；null 表示无父任务。',
        },
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
          en: 'Page of tasks and repeat task configs.',
          zh: '本页的任务与重复任务配置。',
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
        name: 'items.kind',
        required: true,
        description: {
          en: 'task or repeat-task-config.',
          zh: 'task 或 repeat-task-config。',
        },
      },
      {
        name: 'items.id',
        required: true,
        description: joinSentence(idLead, onTaskAndRepeatConfig),
      },
      {
        name: 'items.name',
        required: true,
        description: joinSentence(nameLead, onTaskAndRepeatConfig),
      },
      {
        name: 'items.status',
        required: true,
        description: joinSentence(incompleteOrComplete, whenKindIsTask),
      },
      {
        name: 'items.parentId',
        required: true,
        description: {
          en: 'Parent task UUID, or null. Present when items.kind is task.',
          zh: '父任务 UUID，或 null。当 items.kind 为 task 时有。',
        },
      },
      {
        name: 'items.priority',
        required: true,
        description: joinSentence(priorityChoices, onTaskAndRepeatConfig),
      },
      {
        name: 'items.repeatTaskConfigId',
        required: true,
        description: {
          en: 'Repeat task config UUID, or null. Present when items.kind is task.',
          zh: '重复任务配置 UUID，或 null。当 items.kind 为 task 时有。',
        },
      },
      {
        name: 'items.startsAt',
        required: true,
        description: {
          en: 'ISO-8601 timestamp at the local start of the start date, or null. Present when items.kind is task.',
          zh: '开始日本地起始时刻的 ISO-8601 时间戳，或 null。当 items.kind 为 task 时有。',
        },
      },
      {
        name: 'items.endsAt',
        required: true,
        description: {
          en: 'ISO-8601 timestamp at the local end of the end date, or null. Present when items.kind is task.',
          zh: '结束日本地结束时刻的 ISO-8601 时间戳，或 null。当 items.kind 为 task 时有。',
        },
      },
      {
        name: 'items.completedAt',
        required: true,
        description: {
          en: 'ISO-8601 timestamp when the task was actually finished, or null. Present when items.kind is task.',
          zh: '任务实际完成时的 ISO-8601 时间戳，或 null。当 items.kind 为 task 时有。',
        },
      },
      {
        name: 'items.createdAt',
        required: true,
        description: joinSentence(creationTimeLead, onTaskAndRepeatConfig),
      },
      {
        name: 'items.updatedAt',
        required: true,
        description: joinSentence(updateTimeLead, onTaskAndRepeatConfig),
      },
      {
        name: 'items.period',
        required: true,
        description: joinSentence(periodChoices, whenKindIsRepeatConfig),
      },
      {
        name: 'items.interval',
        required: true,
        description: joinSentence(integerGte1, whenKindIsRepeatConfig),
      },
      {
        name: 'items.timesPerPeriod',
        required: true,
        description: joinSentence(integerGte1, whenKindIsRepeatConfig),
      },
      {
        name: 'items.enabled',
        required: true,
        description: joinSentence(booleanValue, whenKindIsRepeatConfig),
      },
      {
        name: 'items.remaining',
        required: true,
        description: {
          en: 'Completions still due in the current period. Present when items.kind is repeat-task-config.',
          zh: '当前周期内仍待完成的次数。当 items.kind 为 repeat-task-config 时有。',
        },
      },
      errorField,
    ],
  },
  run(context) {
    return runJsonCommand(
      context,
      async (params) => {
        const page = await listTasks(context.dataDir, parseTaskListParams(params), new Date());
        return jsonSuccess(page);
      },
      { paramsRequired: false },
    );
  },
};
