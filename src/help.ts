import { commands } from './commands/registry.ts';
import type { Command, CommandHelpParam, CommandResult } from './commands/types.ts';

export const helpCommand: Command = {
  name: 'help',
  summary: 'Show this help',
  help: {
    description:
      'Print the program overview. That overview has a title, a usage line, the command list, and top-level options.',
    params: 'none',
    request: [],
    response: [
      {
        name: 'title',
        required: true,
        description: 'Program title at the top of the overview.',
      },
      {
        name: 'Usage',
        required: true,
        description: 'Usage section of the overview.',
      },
      {
        name: 'Commands',
        required: true,
        description: 'Command list in the overview.',
      },
      {
        name: 'Options',
        required: true,
        description: 'Options section of the overview.',
      },
    ],
  },
  run() {
    return Promise.resolve(ok(helpText()));
  },
};

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
  const listed = [helpCommand, ...commands];
  const nameWidth = Math.max(...listed.map((command) => command.name.length)) + 2;
  const commandLines = listed
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

function ok(stdout: string): CommandResult {
  return { exitCode: 0, stdout, stderr: '' };
}
