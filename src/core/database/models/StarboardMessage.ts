export interface StarboardMessageAuthor {
  username: string;
  discriminator: string;
  avatar: string;
  id: string;
}

export interface StarboardMessage {
  guildID: string;
  rootMessageID: string;
  rootChannelID: string;
  reactors: string[];
  author: StarboardMessageAuthor;
  content: string;
  attachments: string[];
  createdAt: Date;
  starboardMsgID: string | null;
}
