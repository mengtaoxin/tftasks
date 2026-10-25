import { describe, expect, it } from 'vitest';
import { jsonFailure, jsonSuccess } from './json-result.ts';

describe('json results', () => {
  it('prints a success object with two-space indent and a trailing newline', () => {
    expect(jsonSuccess({ dataDir: '/tmp/tftasks' })).toEqual({
      exitCode: 0,
      stdout: '{\n  "success": true,\n  "dataDir": "/tmp/tftasks"\n}\n',
      stderr: '',
    });
  });

  it('prints a failure object on stdout', () => {
    expect(jsonFailure('Task not found.')).toEqual({
      exitCode: 1,
      stdout: '{\n  "success": false,\n  "error": "Task not found."\n}\n',
      stderr: '',
    });
  });
});
