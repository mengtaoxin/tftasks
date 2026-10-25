import type { Localized } from '../lang.ts';

export const booleanTrueWhenSucceeds: Localized = {
  en: 'Boolean. True when the command succeeds.',
  zh: '布尔值。命令成功时为 true。',
};

export const errorMessageWhenFails: Localized = {
  en: 'Error message when the command fails.',
  zh: '命令失败时的错误信息。',
};

export const nonEmptyString: Localized = {
  en: 'Non-empty string.',
  zh: '非空字符串。',
};

export const priorityChoices: Localized = {
  en: 'low, medium, or high.',
  zh: 'low、medium 或 high。',
};

export const stringValue: Localized = {
  en: 'String.',
  zh: '字符串。',
};

export const stringDefaultsEmpty: Localized = {
  en: 'String. Defaults to empty.',
  zh: '字符串。默认为空。',
};

export const booleanValue: Localized = {
  en: 'Boolean.',
  zh: '布尔值。',
};

export const periodChoices: Localized = {
  en: 'day, week, month, or year.',
  zh: 'day、week、month 或 year。',
};

export const integerGte1: Localized = {
  en: 'Integer greater than or equal to 1.',
  zh: '大于等于 1 的整数。',
};

export const pageDefaults1: Localized = {
  en: 'Integer greater than or equal to 1. Defaults to 1.',
  zh: '大于等于 1 的整数。默认为 1。',
};

export const pageSizeDefaults20: Localized = {
  en: 'Integer from 1 to 100. Defaults to 20.',
  zh: '1 到 100 的整数。默认为 20。',
};

export const sortDefaultsCreatedAt: Localized = {
  en: 'createdAt, updatedAt, name, or priority. Defaults to createdAt.',
  zh: 'createdAt、updatedAt、name 或 priority。默认为 createdAt。',
};

export const orderDefaultsDesc: Localized = {
  en: 'asc or desc. Defaults to desc.',
  zh: 'asc 或 desc。默认为 desc。',
};

export const queryEmptyNoFilter: Localized = {
  en: 'String. An empty string does not filter.',
  zh: '字符串。空字符串表示不过滤。',
};

export const pageNumberFrom1: Localized = {
  en: 'Page number, starting at 1.',
  zh: '页码，从 1 开始。',
};

export const pageSizeMaxItems: Localized = {
  en: 'Maximum number of items on this page.',
  zh: '本页最多条目数。',
};

export const totalMatchingItems: Localized = {
  en: 'Total number of matching items.',
  zh: '匹配条目总数。',
};

export const taskUuid: Localized = {
  en: 'Task UUID.',
  zh: '任务 UUID。',
};

export const repeatConfigUuid: Localized = {
  en: 'Repeat task config UUID.',
  zh: '重复任务配置 UUID。',
};

export const onTaskAndRepeatConfig: Localized = {
  en: 'Present on task and repeat-task-config items.',
  zh: '在 task 与 repeat-task-config 条目上都有。',
};

export const whenKindIsTask: Localized = {
  en: 'Present when items.kind is task.',
  zh: '当 items.kind 为 task 时有。',
};

export const whenKindIsRepeatConfig: Localized = {
  en: 'Present when items.kind is repeat-task-config.',
  zh: '当 items.kind 为 repeat-task-config 时有。',
};

export function joinSentence(lead: Localized, note: Localized): Localized {
  return {
    en: `${lead.en} ${note.en}`,
    zh: `${lead.zh}${note.zh}`,
  };
}
