import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../cli.ts';

function jsonError(error: string) {
  return {
    exitCode: 1,
    stderr: '',
    stdout: `${JSON.stringify({ success: false, error }, null, 2)}\n`,
  };
}

describe('setting commands', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;
  let dataDir: string;

  beforeEach(async () => {
    previousHome = process.env.TFTASKS_HOME;
    dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-setting-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;
    expect((await run(['init'])).exitCode).toBe(0);
  });

  afterEach(() => {
    if (previousHome === undefined) {
      delete process.env.TFTASKS_HOME;
    } else {
      process.env.TFTASKS_HOME = previousHome;
    }
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  describe('help', () => {
    it('lists setting:create request and response fields', async () => {
      const { request, response } = await settingHelp('setting:create');
      expectHelpFields(request, [
        ['name', true],
        ['value', true],
      ]);
      expectHelpFields(response, [
        ['success', true],
        ['setting', true],
        ['setting.name', true],
        ['setting.value', true],
        ['error', false],
      ]);
    });

    it('lists setting:update request and response fields', async () => {
      const { request, response } = await settingHelp('setting:update');
      expectHelpFields(request, [
        ['name', true],
        ['value', true],
      ]);
      expectHelpFields(response, [
        ['success', true],
        ['setting', true],
        ['setting.name', true],
        ['setting.value', true],
        ['error', false],
      ]);
    });

    it('lists setting:delete request and response fields', async () => {
      const { request, response } = await settingHelp('setting:delete');
      expectHelpFields(request, [['name', true]]);
      expectHelpFields(response, [
        ['success', true],
        ['error', false],
      ]);
      expect(response.split('\n').some((line) => line.startsWith('  setting'))).toBe(false);
    });
  });

  describe('setting:create', () => {
    it('creates a single setting in settings.json', async () => {
      const result = await run([
        'setting:create',
        '--params',
        JSON.stringify({ name: 'theme', value: 'dark' }),
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        success: true,
        setting: { name: 'theme', value: 'dark' },
      });
      expect(await readSettings()).toEqual({
        version: 1,
        lang: 'en',
        theme: 'dark',
      });
    });

    it('rejects creating a setting that already exists', async () => {
      const result = await run([
        'setting:create',
        '--params',
        JSON.stringify({ name: 'lang', value: 'zh' }),
      ]);

      expect(result).toEqual(jsonError('Setting already exists.'));
      expect(await readSettings()).toEqual({ version: 1, lang: 'en' });
    });

    it('rejects creating the reserved version setting', async () => {
      const result = await run([
        'setting:create',
        '--params',
        JSON.stringify({ name: 'version', value: 2 }),
      ]);

      expect(result).toEqual(jsonError('Setting name is reserved: version.'));
    });

    it('rejects an invalid lang value', async () => {
      await writeSettings({ version: 1 });

      const result = await run([
        'setting:create',
        '--params',
        JSON.stringify({ name: 'lang', value: 'fr' }),
      ]);

      expect(result).toEqual(jsonError('Invalid lang.'));
    });

    it('requires name and value', async () => {
      expect(await run(['setting:create', '--params', JSON.stringify({ value: 'x' })])).toEqual(
        jsonError('Missing field: name.'),
      );
      expect(await run(['setting:create', '--params', JSON.stringify({ name: 'theme' })])).toEqual(
        jsonError('Missing field: value.'),
      );
    });

    it('rejects unknown fields', async () => {
      expect(
        await run([
          'setting:create',
          '--params',
          JSON.stringify({ name: 'theme', value: 'dark', extra: 1 }),
        ]),
      ).toEqual(jsonError('Unknown field: extra.'));
    });

    it('fails when not initialized', async () => {
      const absent = path.join(tmpdir(), `tftasks-setting-absent-${randomUUID()}`);
      process.env.TFTASKS_HOME = absent;
      cleanup.push(absent);

      expect(
        await run(['setting:create', '--params', JSON.stringify({ name: 'theme', value: 'dark' })]),
      ).toEqual(jsonError('Not initialized. Run tftasks init.'));
    });
  });

  describe('setting:update', () => {
    it('updates a single existing setting', async () => {
      const result = await run([
        'setting:update',
        '--params',
        JSON.stringify({ name: 'lang', value: 'zh' }),
      ]);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        success: true,
        setting: { name: 'lang', value: 'zh' },
      });
      expect(await readSettings()).toEqual({ version: 1, lang: 'zh' });
    });

    it('rejects updating a missing setting', async () => {
      const result = await run([
        'setting:update',
        '--params',
        JSON.stringify({ name: 'theme', value: 'dark' }),
      ]);

      expect(result).toEqual(jsonError('Setting not found.'));
    });

    it('rejects updating the reserved version setting', async () => {
      const result = await run([
        'setting:update',
        '--params',
        JSON.stringify({ name: 'version', value: 2 }),
      ]);

      expect(result).toEqual(jsonError('Setting name is reserved: version.'));
      expect(await readSettings()).toEqual({ version: 1, lang: 'en' });
    });

    it('rejects an invalid lang value', async () => {
      const result = await run([
        'setting:update',
        '--params',
        JSON.stringify({ name: 'lang', value: 'fr' }),
      ]);

      expect(result).toEqual(jsonError('Invalid lang.'));
      expect(await readSettings()).toEqual({ version: 1, lang: 'en' });
    });
  });

  describe('setting:delete', () => {
    it('deletes a single existing setting', async () => {
      const result = await run(['setting:delete', '--params', JSON.stringify({ name: 'lang' })]);

      expect(result).toEqual({
        exitCode: 0,
        stderr: '',
        stdout: `${JSON.stringify({ success: true }, null, 2)}\n`,
      });
      expect(await readSettings()).toEqual({ version: 1 });
    });

    it('rejects deleting a missing setting', async () => {
      const result = await run(['setting:delete', '--params', JSON.stringify({ name: 'theme' })]);

      expect(result).toEqual(jsonError('Setting not found.'));
    });

    it('rejects deleting the reserved version setting', async () => {
      const result = await run(['setting:delete', '--params', JSON.stringify({ name: 'version' })]);

      expect(result).toEqual(jsonError('Setting name is reserved: version.'));
      expect(await readSettings()).toEqual({ version: 1, lang: 'en' });
    });

    it('requires name', async () => {
      expect(await run(['setting:delete', '--params', JSON.stringify({})])).toEqual(
        jsonError('Missing field: name.'),
      );
    });
  });

  async function readSettings(): Promise<unknown> {
    return JSON.parse(await readFile(path.join(dataDir, 'settings.json'), 'utf8'));
  }

  async function writeSettings(value: unknown): Promise<void> {
    await writeFile(path.join(dataDir, 'settings.json'), `${JSON.stringify(value, null, 2)}\n`);
  }
});

async function settingHelp(command: string): Promise<{ request: string; response: string }> {
  const result = await run([command, '--help']);
  expect(result.exitCode).toBe(0);
  const text = result.stdout;
  const requestIndex = text.indexOf('Request:');
  const responseIndex = text.indexOf('Response:');
  expect(requestIndex).toBeGreaterThan(-1);
  expect(responseIndex).toBeGreaterThan(requestIndex);
  return {
    request: text.slice(requestIndex, responseIndex),
    response: text.slice(responseIndex),
  };
}

function expectHelpFields(section: string, fields: readonly (readonly [string, boolean])[]): void {
  for (const [name, required] of fields) {
    const requirement = required ? 'required' : 'optional';
    const escaped = name.replaceAll('.', '\\.');
    expect(section).toMatch(new RegExp(`^  ${escaped} +${requirement} +\\S`, 'm'));
  }
}
