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
});
