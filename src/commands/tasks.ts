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
import type { Command } from './types.ts';

export const taskCreateCommand: Command = {
  name: 'task:create',
  summary: 'Create a task',
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
