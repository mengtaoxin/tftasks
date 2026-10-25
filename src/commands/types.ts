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
  readonly description: string;
};

export type CommandHelp = {
  readonly description: string;
  readonly params: CommandParamsMode;
  readonly request: readonly CommandHelpParam[];
  readonly response: readonly CommandHelpParam[];
};

export type Command = {
  name: string;
  summary: string;
  help: CommandHelp;
  run: (context: CommandContext) => Promise<CommandResult>;
};
