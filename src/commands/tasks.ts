import { jsonSuccess } from '../json-result.ts';
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
  description: 'Boolean. True when the command succeeds.',
};

const errorField: CommandHelpParam = {
  name: 'error',
  required: false,
  description: 'Error message when the command fails.',
};

const taskFields: readonly CommandHelpParam[] = [
  {
    name: 'task',
    required: true,
    description: 'The task.',
  },
  {
    name: 'task.id',
    required: true,
    description: 'Task UUID.',
  },
  {
    name: 'task.name',
    required: true,
    description: 'Non-empty task name.',
  },
  {
    name: 'task.status',
    required: true,
    description: 'incomplete or complete.',
  },
  {
    name: 'task.parentId',
    required: true,
    description: 'Parent task UUID, or null.',
  },
  {
    name: 'task.priority',
    required: true,
    description: 'low, medium, or high.',
  },
  {
    name: 'task.repeatTaskConfigId',
    required: true,
    description: 'Repeat task config UUID, or null.',
  },
  {
    name: 'task.startsAt',
    required: true,
    description: 'ISO-8601 timestamp at the local start of the start date, or null.',
  },
  {
    name: 'task.endsAt',
    required: true,
    description: 'ISO-8601 timestamp at the local end of the end date, or null.',
  },
  {
    name: 'task.completedAt',
    required: true,
    description: 'ISO-8601 timestamp when the task was actually finished, or null.',
  },
  {
    name: 'task.createdAt',
    required: true,
    description: 'ISO-8601 timestamp when the task was created.',
  },
  {
    name: 'task.updatedAt',
    required: true,
    description: 'ISO-8601 timestamp when the task was last updated.',
  },
  {
    name: 'task.detail',
    required: true,
    description: 'Task detail text.',
  },
  {
    name: 'task.detailPath',
    required: true,
    description: 'Absolute path of the task detail file.',
  },
];

const taskResponse: readonly CommandHelpParam[] = [successField, ...taskFields, errorField];

function taskCommandHelp(description: string, request: readonly CommandHelpParam[]): CommandHelp {
  return {
    description,
    params: 'required',
    request,
    response: taskResponse,
  };
}

const onTaskAndRepeatConfig = 'Present on task and repeat-task-config items.';
const whenKindIsTask = 'Present when items.kind is task.';
const whenKindIsRepeatConfig = 'Present when items.kind is repeat-task-config.';

export const taskCreateCommand: Command = {
  name: 'task:create',
  summary: 'Create a task',
  help: taskCommandHelp('Create a task with a name and priority.', [
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
      name: 'detail',
      required: false,
      description: 'String. Defaults to empty.',
    },
    {
      name: 'parentId',
      required: false,
      description: 'Task UUID or null. Defaults to null.',
    },
    {
      name: 'startsAt',
      required: false,
      description:
        'YYYY-MM-DD or an ISO-8601 timestamp. Stored as the local start of that day. Defaults to null.',
    },
    {
      name: 'endsAt',
      required: false,
      description:
        'YYYY-MM-DD or an ISO-8601 timestamp. Stored as the local end of that day. Defaults to null.',
    },
  ]),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const task = await createTask(context.dataDir, parseCreateParams(params));
      return jsonSuccess({ task });
    });
  },
};

export const taskReadCommand: Command = {
  name: 'task:read',
  summary: 'Read a task',
  help: taskCommandHelp('Read one task by id.', [
    {
      name: 'id',
      required: true,
      description: 'Task UUID.',
    },
  ]),
  run(context) {
    return runJsonCommand(context, async (params) => {
      const task = await readTask(context.dataDir, parseIdParams(params));
      return jsonSuccess({ task });
    });
  },
};

export const taskUpdateCommand: Command = {
  name: 'task:update',
  summary: 'Update a task',
  help: taskCommandHelp(
    'Change the name, detail, priority, parent, start date, or end date of an incomplete task.',
    [
      {
        name: 'id',
        required: true,
        description: 'Task UUID.',
      },
      {
        name: 'name',
        required: false,
        description: 'Non-empty string.',
      },
      {
        name: 'detail',
        required: false,
        description: 'String.',
      },
      {
        name: 'priority',
        required: false,
        description: 'low, medium, or high.',
      },
      {
        name: 'parentId',
        required: false,
        description: 'Task UUID or null.',
      },
      {
        name: 'startsAt',
        required: false,
        description:
          'YYYY-MM-DD, an ISO-8601 timestamp, or null. Stored as the local start of that day. Null clears it.',
      },
      {
        name: 'endsAt',
        required: false,
        description:
          'YYYY-MM-DD, an ISO-8601 timestamp, or null. Stored as the local end of that day. Null clears it.',
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
  summary: 'Delete a task',
  help: {
    description: 'Delete a task by id.',
    params: 'required',
    request: [
      {
        name: 'id',
        required: true,
        description: 'Task UUID.',
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
  summary: 'Finish a task',
  help: taskCommandHelp(
    'Finish a task or a repeat task config. Both kinds return the completed task.',
    [
      {
        name: 'kind',
        required: true,
        description: 'task or repeat-task-config.',
      },
      {
        name: 'id',
        required: true,
        description: 'UUID of the task or repeat task config.',
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
  summary: 'List tasks',
  help: {
    description: 'List tasks and repeat task configs. Filters and paging are optional.',
    params: 'optional',
    request: [
      {
        name: 'status',
        required: false,
        description: 'incomplete, complete, or all. Defaults to incomplete.',
      },
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
        name: 'parentId',
        required: false,
        description:
          'Task UUID or null. When set, only tasks with that parent are included; null means no parent.',
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
        description: 'Page of tasks and repeat task configs.',
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
        name: 'items.kind',
        required: true,
        description: 'task or repeat-task-config.',
      },
      {
        name: 'items.id',
        required: true,
        description: `Id. ${onTaskAndRepeatConfig}`,
      },
      {
        name: 'items.name',
        required: true,
        description: `Name. ${onTaskAndRepeatConfig}`,
      },
      {
        name: 'items.status',
        required: true,
        description: `incomplete or complete. ${whenKindIsTask}`,
      },
      {
        name: 'items.parentId',
        required: true,
        description: `Parent task UUID, or null. ${whenKindIsTask}`,
      },
      {
        name: 'items.priority',
        required: true,
        description: `low, medium, or high. ${onTaskAndRepeatConfig}`,
      },
      {
        name: 'items.repeatTaskConfigId',
        required: true,
        description: `Repeat task config UUID, or null. ${whenKindIsTask}`,
      },
      {
        name: 'items.startsAt',
        required: true,
        description: `ISO-8601 timestamp at the local start of the start date, or null. ${whenKindIsTask}`,
      },
      {
        name: 'items.endsAt',
        required: true,
        description: `ISO-8601 timestamp at the local end of the end date, or null. ${whenKindIsTask}`,
      },
      {
        name: 'items.completedAt',
        required: true,
        description: `ISO-8601 timestamp when the task was actually finished, or null. ${whenKindIsTask}`,
      },
      {
        name: 'items.createdAt',
        required: true,
        description: `ISO-8601 creation time. ${onTaskAndRepeatConfig}`,
      },
      {
        name: 'items.updatedAt',
        required: true,
        description: `ISO-8601 update time. ${onTaskAndRepeatConfig}`,
      },
      {
        name: 'items.period',
        required: true,
        description: `day, week, month, or year. ${whenKindIsRepeatConfig}`,
      },
      {
        name: 'items.interval',
        required: true,
        description: `Integer greater than or equal to 1. ${whenKindIsRepeatConfig}`,
      },
      {
        name: 'items.timesPerPeriod',
        required: true,
        description: `Integer greater than or equal to 1. ${whenKindIsRepeatConfig}`,
      },
      {
        name: 'items.enabled',
        required: true,
        description: `Boolean. ${whenKindIsRepeatConfig}`,
      },
      {
        name: 'items.remaining',
        required: true,
        description: `Completions still due in the current period. ${whenKindIsRepeatConfig}`,
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
