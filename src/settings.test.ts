import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings } from './settings.ts';

describe('loadSettings', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  function tempDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'tftasks-settings-'));
    cleanup.push(dir);
    return dir;
  }

  it('returns defaults when settings.json is missing', async () => {
    const dataDir = path.join(tmpdir(), `tftasks-settings-absent-${randomUUID()}`);
    cleanup.push(dataDir);

    await expect(loadSettings(dataDir)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('reads lang from settings.json', async () => {
    const dataDir = tempDir();
    await writeFile(
      path.join(dataDir, 'settings.json'),
      `${JSON.stringify({ version: 1, lang: 'zh' }, null, 2)}\n`,
    );

    await expect(loadSettings(dataDir)).resolves.toEqual({ version: 1, lang: 'zh' });
  });

  it('defaults lang to en when the field is missing', async () => {
    const dataDir = tempDir();
    await writeFile(
      path.join(dataDir, 'settings.json'),
      `${JSON.stringify({ version: 1 }, null, 2)}\n`,
    );

    await expect(loadSettings(dataDir)).resolves.toEqual({ version: 1, lang: 'en' });
  });

  it('defaults lang to en when the value is invalid', async () => {
    const dataDir = tempDir();
    await writeFile(
      path.join(dataDir, 'settings.json'),
      `${JSON.stringify({ version: 1, lang: 'fr' }, null, 2)}\n`,
    );

    await expect(loadSettings(dataDir)).resolves.toEqual({ version: 1, lang: 'en' });
  });

  it('returns defaults when settings.json is not valid JSON', async () => {
    const dataDir = tempDir();
    await writeFile(path.join(dataDir, 'settings.json'), '{not-json');

    await expect(loadSettings(dataDir)).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when settings.json is not an object', async () => {
    const dataDir = tempDir();
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'settings.json'), '"en"\n');

    await expect(loadSettings(dataDir)).resolves.toEqual(DEFAULT_SETTINGS);
  });
});
