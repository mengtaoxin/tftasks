export type CommandContext = {
  args: readonly string[];
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type Command = {
  name: string;
  summary: string;
  run: (context: CommandContext) => CommandResult;
};
