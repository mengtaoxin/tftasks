import { backupCreateCommand } from './backup.ts';
import { initCommand } from './init.ts';
import {
  repeatTaskConfigCreateCommand,
  repeatTaskConfigDeleteCommand,
  repeatTaskConfigListCommand,
  repeatTaskConfigReadCommand,
  repeatTaskConfigUpdateCommand,
} from './repeat-task-configs.ts';
import { settingCreateCommand, settingDeleteCommand, settingUpdateCommand } from './settings.ts';
import {
  taskCreateCommand,
  taskDeleteCommand,
  taskFinishCommand,
  taskListCommand,
  taskReadCommand,
  taskUpdateCommand,
} from './tasks.ts';
import type { Command } from './types.ts';

/**
 * Task commands land here. `tftasks --help` lists every entry.
 */
export const commands: readonly Command[] = [
  initCommand,
  backupCreateCommand,
  settingCreateCommand,
  settingUpdateCommand,
  settingDeleteCommand,
  taskCreateCommand,
  taskReadCommand,
  taskUpdateCommand,
  taskDeleteCommand,
  taskFinishCommand,
  taskListCommand,
  repeatTaskConfigCreateCommand,
  repeatTaskConfigReadCommand,
  repeatTaskConfigUpdateCommand,
  repeatTaskConfigDeleteCommand,
  repeatTaskConfigListCommand,
];
