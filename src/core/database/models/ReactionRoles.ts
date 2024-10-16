import { ReactionRoleTypes } from "../../../Constants";

export interface ReactionEmoji {
  name: string;
  id: string | null;
  animated: boolean;
}
export interface Reaction {
  role: string;
  emoji: ReactionEmoji;
}

export interface ReactionRoles {
  guildID: string;
  channelID: string;
  messageID: string;
  reactions: Reaction[];
  type: ReactionRoleTypes;
}
