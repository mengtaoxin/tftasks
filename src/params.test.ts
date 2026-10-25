import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readParams } from './params.ts';

const dirs: string[] = [];

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'tftasks-params-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  dirs.length = 0;
});

describe('readParams', () => {
  it('reads a JSON object from --params', async () => {
    const result = await readParams(['--params', '{"priority":"high","n":1}'], {
      dataDir: makeDir(),
    });

    expect(result).toEqual({
      ok: true,
      params: { priority: 'high', n: 1 },
    });
  });

  it('reads a relative --params-file from the data directory', async () => {
    const dataDir = makeDir();
    await mkdir(path.join(dataDir, 'nested'));
    await writeFile(path.join(dataDir, 'nested', 'input.json'), '{"from":"data-dir"}\n');

    const result = await readParams(['--params-file', 'nested/input.json'], {
      dataDir,
    });

    expect(result).toEqual({ ok: true, params: { from: 'data-dir' } });
  });

  it('reads an absolute --params-file as given', async () => {
    const dataDir = makeDir();
    const outside = makeDir();
    const filePath = path.join(outside, 'input.json');
    await writeFile(filePath, '{"from":"absolute"}\n');

    const result = await readParams(['--params-file', filePath], { dataDir });

    expect(result).toEqual({ ok: true, params: { from: 'absolute' } });
  });

  it('rejects using --params and --params-file together', async () => {
    const result = await readParams(['--params', '{}', '--params-file', 'input.json'], {
      dataDir: makeDir(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Use either --params or --params-file.',
    });
  });

  it('reports missing params when neither flag is present', async () => {
    const result = await readParams([], { dataDir: makeDir() });

    expect(result).toEqual({
      ok: false,
      error: 'Missing --params or --params-file.',
    });
  });

  it('returns an empty object when params are optional and omitted', async () => {
    const result = await readParams([], {
      dataDir: makeDir(),
      required: false,
    });

    expect(result).toEqual({ ok: true, params: {} });
  });

  it('rejects malformed JSON', async () => {
    const result = await readParams(['--params', '{'], { dataDir: makeDir() });

    expect(result).toEqual({
      ok: false,
      error: 'Params are not valid JSON.',
    });
  });

  it.each(['null', '[]', '"text"', '1', 'true'])('rejects non-object JSON %s', async (raw) => {
    const result = await readParams(['--params', raw], { dataDir: makeDir() });

    expect(result).toEqual({
      ok: false,
      error: 'Params must be a JSON object.',
    });
  });

  it('rejects a missing flag value', async () => {
    const params = await readParams(['--params'], { dataDir: makeDir() });
    const paramsFile = await readParams(['--params-file'], {
      dataDir: makeDir(),
    });

    expect(params).toEqual({
      ok: false,
      error: 'Missing value for --params.',
    });
    expect(paramsFile).toEqual({
      ok: false,
      error: 'Missing value for --params-file.',
    });
  });

  it('rejects unexpected arguments', async () => {
    const result = await readParams(['--params', '{}', 'extra'], {
      dataDir: makeDir(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Unexpected argument: extra',
    });
  });

  it('rejects a params file that cannot be read', async () => {
    const result = await readParams(['--params-file', 'missing.json'], {
      dataDir: makeDir(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Cannot read params file: missing.json',
    });
  });
});
