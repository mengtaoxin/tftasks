import packageJson from '../package.json' with { type: 'json' };
import { commands } from './commands/registry.ts';
import type { CommandResult } from './commands/types.ts';
import { helpCommand, helpText } from './help.ts';

const program = [helpCommand, ...commands];

export function run(argv: readonly string[]): CommandResult {
  const [head, ...rest] = argv;

  if (head === undefined || head === '-h' || head === '--help') {
    return { exitCode: 0, stdout: helpText(), stderr: '' };
  }

  if (head === '-v' || head === '--version') {
    if (rest.length > 0) {
      return usage(`Unexpected arguments after ${head}.`);
    }
    return { exitCode: 0, stdout: `${packageJson.version}\n`, stderr: '' };
  }

  if (head.startsWith('-')) {
    return usage(`Unknown option: ${head}`);
  }

  const command = program.find((item) => item.name === head);
  if (command === undefined) {
    return usage(`Unknown command: ${head}`);
  }

  return command.run({ args: rest });
}

function usage(message: string): CommandResult {
  return {
    exitCode: 1,
    stdout: '',
    stderr: `${message}\nRun "tftasks help" for usage.\n`,
  };
}
