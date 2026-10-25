import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './cli.ts';

describe('help language', () => {
  const cleanup: string[] = [];
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.TFTASKS_HOME;
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

  async function useLang(lang: 'en' | 'zh'): Promise<string> {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'tftasks-help-lang-'));
    cleanup.push(dataDir);
    process.env.TFTASKS_HOME = dataDir;
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      path.join(dataDir, 'settings.json'),
      `${JSON.stringify({ version: 1, lang }, null, 2)}\n`,
    );
    return dataDir;
  }

  it('defaults overview help to English when settings are absent', async () => {
    const absent = path.join(tmpdir(), `tftasks-help-lang-absent-${randomUUID()}`);
    cleanup.push(absent);
    process.env.TFTASKS_HOME = absent;

    const result = await run(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('tftasks — task manager');
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).toContain('Options:');
  });

  it('renders overview help in Chinese when lang is zh', async () => {
    await useLang('zh');

    const result = await run(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('tftasks — 任务管理工具');
    expect(result.stdout).toContain('用法：');
    expect(result.stdout).toContain('命令：');
    expect(result.stdout).toContain('选项：');
    expect(result.stdout).toContain('创建本地数据目录');
    expect(result.stdout).toMatch(/-h,\s+--help/);
    expect(result.stdout).toMatch(/-v,\s+--version/);
    expect(result.stdout).toMatch(/--workspace/);
  });

  it('renders command help in Chinese when lang is zh', async () => {
    await useLang('zh');

    const result = await run(['init', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('init — 创建本地数据目录');
    expect(result.stdout).toContain('用法：');
    expect(result.stdout).toContain('请求：');
    expect(result.stdout).toContain('响应：');
    expect(result.stdout).toContain('无参数。');
    expect(result.stdout).toMatch(/^\s{2}success\s+必填\s+/m);
    expect(result.stdout).toMatch(/^\s{2}dataDir\s+必填\s+/m);
    expect(result.stdout).toMatch(/^\s{2}error\s+可选\s+/m);
  });

  it('localizes CLI usage errors when lang is zh', async () => {
    await useLang('zh');

    const result = await run(['nope']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('未知命令：nope');
    expect(result.stderr).toContain('tftasks --help');
  });
});
