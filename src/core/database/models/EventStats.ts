export interface EventStats {
  timestamp: Date;
  events: { [key: string]: number };
}
