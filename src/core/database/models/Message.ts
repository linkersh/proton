export interface Message {
  id: string;
  channel_id: string;
  guild_id: string;
  user_id: string;
  content: string;
  created_at: Date;
}
