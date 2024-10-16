import { Guild, User } from "eris";

export interface SendDMData {
  dmMessage: string;
  user: User;
  moderator: User;
  guild: Guild;
  reason: string;
}
