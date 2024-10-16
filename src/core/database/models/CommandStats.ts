export interface CommandStats {
  timestamp: Date;
  commands: { [key: string]: number };
}
