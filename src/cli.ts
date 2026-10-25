import packageJson from '../package.json' with { type: 'json' };
import { commands } from './commands/registry.ts';
import type { CommandResult } from './commands/types.ts';
import { resolveDataDir } from './data-dir.ts';
import { helpCommand, helpText } from './help.ts';
import { appendCommandLog } from './log.ts';

const program = [helpCommand, ...commands];

export async function run(argv: readonly string[]): Promise<CommandResult> {
  const dataDir = resolveDataDir();
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

  const result = await command.run({ args: rest, dataDir });
  await appendCommandLog(dataDir, command.name, result.exitCode);
  return result;
}

function usage(message: string): CommandResult {
  return {
    exitCode: 1,
    stdout: '',
    stderr: `${message}\nRun "tftasks help" for usage.\n`,
  };
}
