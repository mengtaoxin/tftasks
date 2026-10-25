import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendCommandLog } from './log.ts';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  dirs.length = 0;
});

function localDay(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('appendCommandLog', () => {
  it('does not create the data directory when it is missing', async () => {
    const dataDir = path.join(tmpdir(), `tftasks-missing-${randomUUID()}`);

    await appendCommandLog(dataDir, 'help', 0, new Date('2026-10-25T16:30:00.000Z'));

    expect(existsSync(dataDir)).toBe(false);
  });

  it('appends a line in the local-day log when the data directory exists', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-log-'));
    dirs.push(dataDir);
    const now = new Date('2026-10-25T16:30:00.000Z');
    const day = localDay(now);
    const utcDay = now.toISOString().slice(0, 10);

    await appendCommandLog(dataDir, 'help', 0, now);
    await appendCommandLog(dataDir, 'task:list', 1, now);

    const text = await readFile(path.join(dataDir, 'logs', `${day}.log`), 'utf8');
    expect(text).toBe(`${now.toISOString()} help exit=0\n${now.toISOString()} task:list exit=1\n`);
    if (day !== utcDay) {
      expect(existsSync(path.join(dataDir, 'logs', `${utcDay}.log`))).toBe(false);
    }
  });
});
