import { commands } from './commands/registry.ts';
import type { Command, CommandHelpParam } from './commands/types.ts';
import { helpChrome } from './i18n/ui.ts';
import type { Lang } from './lang.ts';
import { text } from './lang.ts';

export function renderCommandHelp(command: Command, lang: Lang): string {
  const chrome = helpChrome(lang);
  const { help } = command;
  return [
    `${command.name} — ${text(lang, command.summary)}`,
    '',
    text(lang, help.description),
    '',
    chrome.usage,
    usageLine(command),
    '',
    chrome.request,
    formatParams(help.request, lang),
    '',
    chrome.response,
    formatParams(help.response, lang),
    '',
  ].join('\n');
}

export function helpText(lang: Lang): string {
  const chrome = helpChrome(lang);
  const nameWidth = Math.max(...commands.map((command) => command.name.length)) + 2;
  const commandLines = commands
    .map((command) => `  ${command.name.padEnd(nameWidth)}${text(lang, command.summary)}`)
    .join('\n');

  return [
    chrome.overviewTitle,
    '',
    chrome.usage,
    '  tftasks <command> [args]',
    '',
    chrome.commands,
    commandLines,
    '',
    chrome.options,
    `  -h, --help         ${chrome.helpOption}`,
    `  -v, --version      ${chrome.versionOption}`,
    `  --workspace <path> ${chrome.workspaceOption}`,
    '',
  ].join('\n');
}

function usageLine(command: Command): string {
  const invocation = `tftasks ${command.name} [--workspace <path>]`;
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

function formatParams(params: readonly CommandHelpParam[], lang: Lang): string {
  const chrome = helpChrome(lang);
  if (params.length === 0) {
    return `  ${chrome.noParameters}`;
  }

  const nameWidth = Math.max(...params.map((param) => param.name.length)) + 2;
  const requirementWidth = Math.max(chrome.required.length, chrome.optional.length) + 2;
  return params
    .map((param) => {
      const requirement = param.required ? chrome.required : chrome.optional;
      return `  ${param.name.padEnd(nameWidth)}${requirement.padEnd(requirementWidth)}${text(lang, param.description)}`;
    })
    .join('\n');
}

function assertNever(value: never): never {
  throw new Error(`Unexpected params mode: ${String(value)}`);
}
