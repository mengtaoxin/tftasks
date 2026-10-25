import type { Lang, Localized } from '../lang.ts';
import { text } from '../lang.ts';

const overviewTitle: Localized = {
  en: 'tftasks — task manager',
  zh: 'tftasks — 任务管理工具',
};

const usage: Localized = {
  en: 'Usage:',
  zh: '用法：',
};

const commands: Localized = {
  en: 'Commands:',
  zh: '命令：',
};

const options: Localized = {
  en: 'Options:',
  zh: '选项：',
};

const helpOption: Localized = {
  en: "Show this overview. After a command alone, show only that command's help",
  zh: '显示本总览。单独跟在命令后时，只显示该命令的帮助',
};

const versionOption: Localized = {
  en: 'Show version',
  zh: '显示版本',
};

const workspaceOption: Localized = {
  en: 'Workspace directory (default: ~/.tftasks). Must exist when set',
  zh: '工作区目录（默认：~/.tftasks）。指定时路径必须已存在',
};

const request: Localized = {
  en: 'Request:',
  zh: '请求：',
};

const response: Localized = {
  en: 'Response:',
  zh: '响应：',
};

const noParameters: Localized = {
  en: 'No parameters.',
  zh: '无参数。',
};

const required: Localized = {
  en: 'required',
  zh: '必填',
};

const optional: Localized = {
  en: 'optional',
  zh: '可选',
};

const unknownOption: Localized = {
  en: 'Unknown option',
  zh: '未知选项',
};

const unknownCommand: Localized = {
  en: 'Unknown command',
  zh: '未知命令',
};

const unexpectedArgsAfter: Localized = {
  en: 'Unexpected arguments after',
  zh: '其后有多余参数：',
};

const runHelpForUsage: Localized = {
  en: 'Run "tftasks --help" for usage.',
  zh: '运行 "tftasks --help" 查看用法。',
};

export type HelpChrome = {
  readonly overviewTitle: string;
  readonly usage: string;
  readonly commands: string;
  readonly options: string;
  readonly helpOption: string;
  readonly versionOption: string;
  readonly workspaceOption: string;
  readonly request: string;
  readonly response: string;
  readonly noParameters: string;
  readonly required: string;
  readonly optional: string;
};

export function helpChrome(lang: Lang): HelpChrome {
  return {
    overviewTitle: text(lang, overviewTitle),
    usage: text(lang, usage),
    commands: text(lang, commands),
    options: text(lang, options),
    helpOption: text(lang, helpOption),
    versionOption: text(lang, versionOption),
    workspaceOption: text(lang, workspaceOption),
    request: text(lang, request),
    response: text(lang, response),
    noParameters: text(lang, noParameters),
    required: text(lang, required),
    optional: text(lang, optional),
  };
}

export function usageUnknownOption(lang: Lang, option: string): string {
  const sep = lang === 'zh' ? '：' : ': ';
  return `${text(lang, unknownOption)}${sep}${option}`;
}

export function usageUnknownCommand(lang: Lang, command: string): string {
  const sep = lang === 'zh' ? '：' : ': ';
  return `${text(lang, unknownCommand)}${sep}${command}`;
}

export function usageUnexpectedArgsAfter(lang: Lang, flag: string): string {
  if (lang === 'zh') {
    return `${text(lang, unexpectedArgsAfter)}${flag}`;
  }
  return `${text(lang, unexpectedArgsAfter)} ${flag}.`;
}

export function usageFooter(lang: Lang): string {
  return text(lang, runHelpForUsage);
}
