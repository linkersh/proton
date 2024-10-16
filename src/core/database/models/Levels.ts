export interface LevelXP {
  total: number;
  current: number;
  required: number;
}
export interface Level {
  guildID: string;
  userID: string;
  level: number;
  xp: LevelXP;
  rankcardImage?: string;
  rankcardColor?: string;
}
