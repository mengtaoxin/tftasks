import { AppError } from '../errors.ts';
import { booleanTrueWhenSucceeds, errorMessageWhenFails, nonEmptyString } from '../i18n/common.ts';
import { jsonSuccess } from '../json-result.ts';
import { createSetting, deleteSetting, updateSetting } from '../settings.ts';
import { runJsonCommand } from './run-json.ts';
import type { Command, CommandHelpParam } from './types.ts';

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

const settingNameField: CommandHelpParam = {
  name: 'name',
  required: true,
  description: {
    en: 'Non-empty setting name. The name version is reserved.',
    zh: '非空配置名。version 为保留名。',
  },
};

const settingValueField: CommandHelpParam = {
  name: 'value',
  required: true,
  description: {
    en: 'JSON value for the setting. For lang, must be en or zh.',
    zh: '配置的 JSON 值。lang 必须是 en 或 zh。',
  },
};

const settingResponseFields: readonly CommandHelpParam[] = [
  successField,
  {
    name: 'setting',
    required: true,
    description: {
      en: 'The setting.',
      zh: '配置项。',
    },
  },
  {
    name: 'setting.name',
    required: true,
    description: nonEmptyString,
  },
  {
    name: 'setting.value',
    required: true,
    description: {
      en: 'JSON value.',
      zh: 'JSON 值。',
    },
  },
  errorField,
];

const CREATE_FIELDS = ['name', 'value'] as const;
const UPDATE_FIELDS = ['name', 'value'] as const;
const DELETE_FIELDS = ['name'] as const;

export const settingCreateCommand: Command = {
  name: 'setting:create',
  summary: {
    en: 'Create a setting',
    zh: '创建配置',
  },
  help: {
    description: {
      en: 'Create a single setting in settings.json.',
      zh: '在 settings.json 中创建一条配置。',
    },
    params: 'required',
    request: [settingNameField, settingValueField],
    response: settingResponseFields,
  },
  run(context) {
    return runJsonCommand(context, async (params) => {
      const { name, value } = parseNameValueParams(params, CREATE_FIELDS);
      const setting = await createSetting(context.dataDir, name, value);
      return jsonSuccess({ setting });
    });
  },
};

export const settingUpdateCommand: Command = {
  name: 'setting:update',
  summary: {
    en: 'Update a setting',
    zh: '更新配置',
  },
  help: {
    description: {
      en: 'Update a single existing setting in settings.json.',
      zh: '更新 settings.json 中已有的一条配置。',
    },
    params: 'required',
    request: [settingNameField, settingValueField],
    response: settingResponseFields,
  },
  run(context) {
    return runJsonCommand(context, async (params) => {
      const { name, value } = parseNameValueParams(params, UPDATE_FIELDS);
      const setting = await updateSetting(context.dataDir, name, value);
      return jsonSuccess({ setting });
    });
  },
};

export const settingDeleteCommand: Command = {
  name: 'setting:delete',
  summary: {
    en: 'Delete a setting',
    zh: '删除配置',
  },
  help: {
    description: {
      en: 'Delete a single setting from settings.json.',
      zh: '从 settings.json 删除一条配置。',
    },
    params: 'required',
    request: [settingNameField],
    response: [successField, errorField],
  },
  run(context) {
    return runJsonCommand(context, async (params) => {
      const name = parseNameParams(params);
      await deleteSetting(context.dataDir, name);
      return jsonSuccess({});
    });
  },
};

function parseNameValueParams(
  params: Record<string, unknown>,
  allowed: readonly string[],
): { name: string; value: unknown } {
  assertAllowed(params, allowed);
  if (!('name' in params)) {
    throw new AppError('Missing field: name.');
  }
  if (!('value' in params)) {
    throw new AppError('Missing field: value.');
  }
  return { name: parseName(params.name), value: params.value };
}

function parseNameParams(params: Record<string, unknown>): string {
  assertAllowed(params, DELETE_FIELDS);
  if (!('name' in params)) {
    throw new AppError('Missing field: name.');
  }
  return parseName(params.name);
}

function parseName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('Invalid name.');
  }
  return value;
}

function assertAllowed(params: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(params)) {
    if (!allowed.includes(key)) {
      throw new AppError(`Unknown field: ${key}.`);
    }
  }
}
