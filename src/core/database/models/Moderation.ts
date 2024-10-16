import { ModerationTypes } from "../../../Constants";

export interface Moderation {
  _id: string;
  guildID: string;
  userID: string;
  type: ModerationTypes;
  createdAt: Date;
  expiresAt: Date;
}

export interface ModerationStructure {
  guildID: string;
  userID: string;
  type: ModerationTypes;
  createdAt: Date;
  expiresAt: Date;
}
