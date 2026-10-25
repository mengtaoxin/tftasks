import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractWorkspace, resolveWorkspace } from './workspace.ts';

describe('extractWorkspace', () => {
  it('leaves args unchanged when --workspace is absent', () => {
    expect(extractWorkspace(['--params', '{}'])).toEqual({
      ok: true,
      workspace: undefined,
      args: ['--params', '{}'],
    });
  });

  it('extracts --workspace and returns the remaining args', () => {
    expect(extractWorkspace(['--workspace', '/tmp/ws', '--params', '{}'])).toEqual({
      ok: true,
      workspace: '/tmp/ws',
      args: ['--params', '{}'],
    });
    expect(extractWorkspace(['--params', '{}', '--workspace', '/tmp/ws'])).toEqual({
      ok: true,
      workspace: '/tmp/ws',
      args: ['--params', '{}'],
    });
  });

  it('rejects a missing or flag-like value for --workspace', () => {
    expect(extractWorkspace(['--workspace'])).toEqual({
      ok: false,
      error: 'Missing value for --workspace.',
    });
    expect(extractWorkspace(['--workspace', '--params'])).toEqual({
      ok: false,
      error: 'Missing value for --workspace.',
    });
  });

  it('rejects a duplicate --workspace', () => {
    expect(extractWorkspace(['--workspace', '/a', '--workspace', '/b'])).toEqual({
      ok: false,
      error: 'Duplicate --workspace.',
    });
  });
});

describe('resolveWorkspace', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
    cleanup.length = 0;
  });

  it('uses TFTASKS_HOME or ~/.tftasks when --workspace is omitted', () => {
    expect(resolveWorkspace(undefined, { TFTASKS_HOME: '/tmp/home' })).toEqual({
      ok: true,
      dataDir: '/tmp/home',
    });
    expect(resolveWorkspace(undefined, {})).toEqual({
      ok: true,
      dataDir: path.join(homedir(), '.tftasks'),
    });
  });

  it('resolves an existing directory path', () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-ws-'));
    cleanup.push(dataDir);

    expect(resolveWorkspace(dataDir)).toEqual({ ok: true, dataDir });
  });

  it('expands a leading ~', () => {
    expect(resolveWorkspace('~')).toEqual({ ok: true, dataDir: homedir() });
  });

  it('rejects a path that does not exist', () => {
    const missing = path.join(tmpdir(), `tftasks-ws-missing-${randomUUID()}`);

    expect(resolveWorkspace(missing)).toEqual({
      ok: false,
      error: `Workspace does not exist: ${missing}`,
    });
  });

  it('rejects a path that is not a directory', () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-ws-'));
    cleanup.push(dataDir);
    const filePath = path.join(dataDir, 'file');
    writeFileSync(filePath, 'x');

    expect(resolveWorkspace(filePath)).toEqual({
      ok: false,
      error: `Workspace does not exist: ${filePath}`,
    });
  });
});
