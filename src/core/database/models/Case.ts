import { PunishmentTypes } from "../../../Constants";

export interface CaseUser {
  id: string;
  username: string;
  discriminator: string;
  avatar_url: string;
}

export interface Case {
  id: number;
  guild_id: string;
  type: PunishmentTypes;
  user: CaseUser;
  moderator: CaseUser;
  duration: number;
  reason: string;
  created_at: Date;
}

export interface CaseStructure {
  guild_id: string;
  type: PunishmentTypes;
  user: CaseUser;
  moderator: CaseUser;
  duration: number;
  reason: string;
}
