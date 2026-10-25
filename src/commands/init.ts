import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDatabase } from '../db/open.ts';
import { jsonFailure, jsonSuccess } from '../json-result.ts';
import { DEFAULT_SETTINGS, settingsPath } from '../settings.ts';
import type { Command } from './types.ts';

export const initCommand: Command = {
  name: 'init',
  summary: {
    en: 'Create the local data directory',
    zh: '创建本地数据目录',
  },
  help: {
    description: {
      en: 'Create the data directory, database, settings file, and subdirectories.',
      zh: '创建数据目录、数据库、配置文件和子目录。',
    },
    params: 'none',
    request: [],
    response: [
      {
        name: 'success',
        required: true,
        description: {
          en: 'Boolean. True when initialization succeeds.',
          zh: '布尔值。初始化成功时为 true。',
        },
      },
      {
        name: 'dataDir',
        required: true,
        description: {
          en: 'Absolute path of the data directory.',
          zh: '数据目录的绝对路径。',
        },
      },
      {
        name: 'error',
        required: false,
        description: {
          en: 'Error message when initialization fails.',
          zh: '初始化失败时的错误信息。',
        },
      },
    ],
  },
  async run(context) {
    const unexpected = context.args[0];
    if (unexpected !== undefined) {
      return jsonFailure(`Unexpected argument: ${unexpected}`);
    }

    await ensureLayout(context.dataDir);
    const db = createDatabase(context.dataDir);
    db.close();
    return jsonSuccess({ dataDir: context.dataDir });
  },
};

async function ensureLayout(dataDir: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await Promise.all([
    mkdir(path.join(dataDir, 'logs'), { recursive: true }),
    mkdir(path.join(dataDir, 'backups'), { recursive: true }),
    mkdir(path.join(dataDir, 'files'), { recursive: true }),
  ]);
  await writeSettingsIfMissing(dataDir);
}

async function writeSettingsIfMissing(dataDir: string): Promise<void> {
  try {
    await writeFile(settingsPath(dataDir), `${JSON.stringify(DEFAULT_SETTINGS, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error: unknown) {
    if (isEexist(error)) {
      return;
    }
    throw error;
  }
}

function isEexist(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}
