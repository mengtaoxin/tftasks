import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './cli.ts';

describe('run', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
    const absent = path.join(tmpdir(), `tftasks-absent-${randomUUID()}`);
    process.env.TFTASKS_HOME = absent;
    cleanup.push(absent);
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

  it('returns a promise', async () => {
    const pending = run([]);
    expect(pending).toBeInstanceOf(Promise);
    await pending;
  });

  it('shows help when called without arguments', async () => {
    const result = await run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('help');
    expect(result.stderr).toBe('');
  });

  it('shows help for the help command and --help', async () => {
    expect((await run(['help'])).stdout).toContain('Commands:');
    expect((await run(['--help'])).stdout).toContain('tftasks — task manager');
  });

  it('says a following --help prints only that command help', async () => {
    const result = await run(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    const helpLine = result.stdout.split('\n').find((line) => line.includes('--help'));
    expect(helpLine).toMatch(/-h,\s+--help/);
    expect(helpLine).toMatch(/command/i);
    expect(helpLine).toMatch(/only/i);
  });

  it('prints the package version', async () => {
    const result = await run(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('rejects extra arguments after --version', async () => {
    const result = await run(['--version', 'extra']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unexpected arguments');
  });

  it('rejects an unknown command', async () => {
    const result = await run(['nope']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Unknown command: nope');
    expect(result.stderr).toContain('tftasks help');
  });

  it('does not create a missing data directory while handling help', async () => {
    const absent = process.env.TFTASKS_HOME;
    if (absent === undefined) {
      throw new Error('TFTASKS_HOME should be set');
    }

    await run(['help']);

    expect(existsSync(absent)).toBe(false);
  });

  it('logs dispatched help when the data directory exists', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-cli-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;

    await run(['help']);

    const logsDir = path.join(dataDir, 'logs');
    expect(existsSync(logsDir)).toBe(true);
    const files = await readdir(logsDir);
    expect(files).toHaveLength(1);
    const fileName = files[0];
    if (fileName === undefined) {
      throw new Error('expected a log file');
    }
    const text = await readFile(path.join(logsDir, fileName), 'utf8');
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z help exit=0\n$/);
  });

  it('does not log version, help flags, or unknown commands', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-cli-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;

    expect((await run(['--version'])).exitCode).toBe(0);
    expect((await run(['--help'])).stdout).toContain('Usage:');
    const unknown = await run(['missing']);

    expect(unknown.stderr).toContain('Unknown command: missing');
    expect(existsSync(path.join(dataDir, 'logs'))).toBe(false);
  });

  it('prints structured help for a command --help or -h without creating a data directory', async () => {
    const absent = process.env.TFTASKS_HOME;
    if (absent === undefined) {
      throw new Error('TFTASKS_HOME should be set');
    }

    const long = await run(['task:create', '--help']);
    const short = await run(['task:create', '-h']);

    for (const result of [long, short]) {
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('task:create — Create a task');
      expect(result.stdout).toContain('Create a task');
      expect(result.stdout).toContain(
        'Usage:\n  tftasks task:create (--params <json> | --params-file <path>)',
      );
      expect(result.stdout).toContain('Request:\n  name');
      expect(result.stdout).toContain('Response:');
    }
    expect(long.stdout).toBe(short.stdout);
    expect(existsSync(absent)).toBe(false);
  });

  it('does not write command logs for subcommand help when the data directory exists', async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-cli-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;

    const result = await run(['task:create', '--help']);

    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(dataDir, 'logs'))).toBe(false);
  });

  it('keeps failing when --help is not the only argument', async () => {
    const result = await run(['task:create', '--help', 'extra']);

    expect(result).toEqual({
      exitCode: 1,
      stderr: '',
      stdout: `${JSON.stringify({ success: false, error: 'Unexpected argument: --help' }, null, 2)}\n`,
    });
  });

  it('still prints the overview for the help command', async () => {
    const result = await run(['help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('tftasks — task manager');
    expect(result.stdout).toContain('tftasks <command> [args]');
    expect(result.stdout).toContain('Commands:');
  });

  it('prints optional params usage for task:list', async () => {
    const result = await run(['task:list', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(
      'Usage:\n  tftasks task:list [--params <json> | --params-file <path>]',
    );
    expect(result.stdout).toContain('Request:\n  status');
  });

  it('lists init results in init --help', async () => {
    const result = await run(['init', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('init — Create the local data directory');
    expect(result.stdout).toContain('Usage:\n  tftasks init\n');
    expect(result.stdout).toContain('Request:\n  No parameters.');
    expect(result.stdout).toMatch(/^\s{2}success\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}dataDir\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}error\s+optional\s+/m);
  });

  it('lists backup results in backup:create --help', async () => {
    const result = await run(['backup:create', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(
      'backup:create — Create a zip backup of the database and files',
    );
    expect(result.stdout).toContain('Usage:\n  tftasks backup:create\n');
    expect(result.stdout).toContain('Request:\n  No parameters.');
    expect(result.stdout).toMatch(/^\s{2}success\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}path\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}error\s+optional\s+/m);
  });

  it('describes the help command itself for help --help', async () => {
    const result = await run(['help', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('help — Show this help');
    expect(result.stdout).toContain('Usage:\n  tftasks help\n');
    expect(result.stdout).toContain('Request:\n  No parameters.');
    expect(result.stdout).toMatch(/^\s{2}title\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}Usage\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}Commands\s+required\s+/m);
    expect(result.stdout).toMatch(/^\s{2}Options\s+required\s+/m);
    expect(result.stdout).not.toContain('tftasks — task manager');
    expect(result.stdout).not.toContain('tftasks <command> [args]');
    expect(result.stdout).not.toContain('task:create');
  });
});
