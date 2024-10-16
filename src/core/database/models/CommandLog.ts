export interface CommandLog {
  guildID: string;
  userID: string;
  command: string;
  message: string;
  slashCommand: boolean;
  createdAt: Date;
  subcommand: string | null;
  executionError: boolean;
}
