import packageJson from '../package.json' with { type: 'json' };
import { commands } from './commands/registry.ts';
import type { CommandResult } from './commands/types.ts';
import { resolveDataDir } from './data-dir.ts';
import { helpText, renderCommandHelp } from './help.ts';
import {
  usageFooter,
  usageUnexpectedArgsAfter,
  usageUnknownCommand,
  usageUnknownOption,
} from './i18n/ui.ts';
import type { Lang } from './lang.ts';
import { appendCommandLog } from './log.ts';
import { loadSettings } from './settings.ts';

export async function run(argv: readonly string[]): Promise<CommandResult> {
  const dataDir = resolveDataDir();
  const { lang } = await loadSettings(dataDir);
  const [head, ...rest] = argv;

  if (head === undefined || head === '-h' || head === '--help') {
    return { exitCode: 0, stdout: helpText(lang), stderr: '' };
  }

  if (head === '-v' || head === '--version') {
    if (rest.length > 0) {
      return usage(lang, usageUnexpectedArgsAfter(lang, head));
    }
    return { exitCode: 0, stdout: `${packageJson.version}\n`, stderr: '' };
  }

  if (head.startsWith('-')) {
    return usage(lang, usageUnknownOption(lang, head));
  }

  const command = commands.find((item) => item.name === head);
  if (command === undefined) {
    return usage(lang, usageUnknownCommand(lang, head));
  }

  if (isCommandHelpRequest(rest)) {
    return { exitCode: 0, stdout: renderCommandHelp(command, lang), stderr: '' };
  }

  const result = await command.run({ args: rest, dataDir });
  await appendCommandLog(dataDir, command.name, result.exitCode);
  return result;
}

function isCommandHelpRequest(args: readonly string[]): boolean {
  return args.length === 1 && (args[0] === '-h' || args[0] === '--help');
}

function usage(lang: Lang, message: string): CommandResult {
  return {
    exitCode: 1,
    stdout: '',
    stderr: `${message}\n${usageFooter(lang)}\n`,
  };
}
