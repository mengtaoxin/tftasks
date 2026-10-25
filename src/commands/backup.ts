import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backup } from 'node:sqlite';
import { collectFiles, createZip } from '../backup/zip.ts';
import { openDatabase } from '../db/open.ts';
import { AppError } from '../errors.ts';
import { jsonFailure, jsonSuccess } from '../json-result.ts';
import type { Command } from './types.ts';

export const backupCreateCommand: Command = {
  name: 'backup:create',
  summary: 'Create a zip backup of the database and files',
  help: {
    description: 'Write a zip archive of the database and attachment files.',
    params: 'none',
    request: [],
    response: [
      {
        name: 'success',
        required: true,
        description: 'Boolean. True when the backup is created.',
      },
      {
        name: 'path',
        required: true,
        description: 'Path of the backup zip.',
      },
      {
        name: 'error',
        required: false,
        description: 'Error message when the backup fails.',
      },
    ],
  },
  async run(context) {
    const unexpected = context.args[0];
    if (unexpected !== undefined) {
      return jsonFailure(`Unexpected argument: ${unexpected}`);
    }

    try {
      const zipPath = await createBackup(context.dataDir);
      return jsonSuccess({ path: zipPath });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return jsonFailure(error.message);
      }
      throw error;
    }
  },
};

async function createBackup(dataDir: string): Promise<string> {
  const db = openDatabase(dataDir);
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'tftasks-backup-'));
  const tempDbPath = path.join(tempRoot, 'tftasks.db');
  try {
    try {
      await backup(db, tempDbPath);
    } finally {
      db.close();
    }

    const fileEntries = await collectFiles(path.join(dataDir, 'files'), 'files').catch(
      (error: unknown) => {
        if (isEnoent(error)) {
          return [];
        }
        throw error;
      },
    );
    const zipBytes = createZip([
      { name: 'tftasks.db', data: new Uint8Array(await readFile(tempDbPath)) },
      ...fileEntries,
    ]);

    const zipPath = path.join(dataDir, 'backups', `${localTimestamp(new Date())}.zip`);
    await writeFile(zipPath, zipBytes);
    return zipPath;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function localTimestamp(now: Date): string {
  const y = now.getFullYear().toString().padStart(4, '0');
  const mo = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  const h = now.getHours().toString().padStart(2, '0');
  const mi = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  return `${y}${mo}${d}-${h}${mi}${s}`;
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
