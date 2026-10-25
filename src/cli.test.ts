import { describe, expect, it } from 'vitest';
import { run } from './cli.ts';

describe('run', () => {
  it('shows help when called without arguments', () => {
    const result = run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('help');
    expect(result.stderr).toBe('');
  });

  it('shows help for the help command and --help', () => {
    expect(run(['help']).stdout).toContain('Commands:');
    expect(run(['--help']).stdout).toContain('tftasks — task manager');
  });

  it('prints the package version', () => {
    const result = run(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('rejects extra arguments after --version', () => {
    const result = run(['--version', 'extra']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unexpected arguments');
  });

  it('rejects an unknown command', () => {
    const result = run(['nope']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Unknown command: nope');
    expect(result.stderr).toContain('tftasks help');
  });
});
