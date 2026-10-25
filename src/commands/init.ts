import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDatabase } from '../db/open.ts';
import { jsonFailure, jsonSuccess } from '../json-result.ts';
import type { Command } from './types.ts';

export const initCommand: Command = {
  name: 'init',
  summary: 'Create the local data directory',
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
    await writeFile(
      path.join(dataDir, 'settings.json'),
      `${JSON.stringify({ version: 1 }, null, 2)}\n`,
      {
        encoding: 'utf8',
        flag: 'wx',
      },
    );
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
