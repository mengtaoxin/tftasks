import { commands } from './commands/registry.ts';
import type { Command, CommandResult } from './commands/types.ts';

export const helpCommand: Command = {
  name: 'help',
  summary: 'Show this help',
  run() {
    return ok(helpText());
  },
};

export function helpText(): string {
  const listed = [helpCommand, ...commands];
  const commandLines = listed
    .map((command) => `  ${command.name.padEnd(12)}${command.summary}`)
    .join('\n');

  return [
    'tftasks — task manager',
    '',
    'Usage:',
    '  tftasks <command> [args]',
    '',
    'Commands:',
    commandLines,
    '',
    'Options:',
    '  -h, --help       Show help',
    '  -v, --version    Show version',
    '',
  ].join('\n');
}

function ok(stdout: string): CommandResult {
  return { exitCode: 0, stdout, stderr: '' };
}
