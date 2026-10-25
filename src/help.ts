import { commands } from './commands/registry.ts';
import type { Command, CommandHelpParam } from './commands/types.ts';

export function renderCommandHelp(command: Command): string {
  const { help } = command;
  return [
    `${command.name} — ${command.summary}`,
    '',
    help.description,
    '',
    'Usage:',
    usageLine(command),
    '',
    'Request:',
    formatParams(help.request),
    '',
    'Response:',
    formatParams(help.response),
    '',
  ].join('\n');
}

export function helpText(): string {
  const nameWidth = Math.max(...commands.map((command) => command.name.length)) + 2;
  const commandLines = commands
    .map((command) => `  ${command.name.padEnd(nameWidth)}${command.summary}`)
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
    "  -h, --help       Show this overview. After a command alone, show only that command's help",
    '  -v, --version    Show version',
    '',
  ].join('\n');
}

function usageLine(command: Command): string {
  const invocation = `tftasks ${command.name}`;
  const flags = '--params <json> | --params-file <path>';
  switch (command.help.params) {
    case 'none':
      return `  ${invocation}`;
    case 'required':
      return `  ${invocation} (${flags})`;
    case 'optional':
      return `  ${invocation} [${flags}]`;
    default:
      return assertNever(command.help.params);
  }
}

function formatParams(params: readonly CommandHelpParam[]): string {
  if (params.length === 0) {
    return '  No parameters.';
  }

  const nameWidth = Math.max(...params.map((param) => param.name.length)) + 2;
  const requirementWidth = 'optional'.length + 2;
  return params
    .map((param) => {
      const requirement = param.required ? 'required' : 'optional';
      return `  ${param.name.padEnd(nameWidth)}${requirement.padEnd(requirementWidth)}${param.description}`;
    })
    .join('\n');
}

function assertNever(value: never): never {
  throw new Error(`Unexpected params mode: ${String(value)}`);
}
