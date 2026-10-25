import type { Localized } from '../lang.ts';

export type CommandContext = {
  args: readonly string[];
  dataDir: string;
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CommandParamsMode = 'none' | 'optional' | 'required';

export type CommandHelpParam = {
  readonly name: string;
  readonly required: boolean;
  readonly description: Localized;
};

export type CommandHelp = {
  readonly description: Localized;
  readonly params: CommandParamsMode;
  readonly request: readonly CommandHelpParam[];
  readonly response: readonly CommandHelpParam[];
};

export type Command = {
  name: string;
  summary: Localized;
  help: CommandHelp;
  run: (context: CommandContext) => Promise<CommandResult>;
};
