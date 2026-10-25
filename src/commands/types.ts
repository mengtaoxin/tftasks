export type CommandContext = {
  args: readonly string[];
  dataDir: string;
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type Command = {
  name: string;
  summary: string;
  run: (context: CommandContext) => Promise<CommandResult>;
};
