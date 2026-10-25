import { homedir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDataDir } from './data-dir.ts';

describe('resolveDataDir', () => {
  it('uses TFTASKS_HOME when it is set', () => {
    expect(resolveDataDir({ TFTASKS_HOME: '/tmp/tftasks-home' })).toBe('/tmp/tftasks-home');
  });

  it('uses ~/.tftasks when TFTASKS_HOME is unset or empty', () => {
    const expected = path.join(homedir(), '.tftasks');

    expect(resolveDataDir({})).toBe(expected);
    expect(resolveDataDir({ TFTASKS_HOME: '' })).toBe(expected);
  });
});
