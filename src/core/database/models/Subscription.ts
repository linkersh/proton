export interface Subscriptions {
  expiresAt: Date;
  price: number;
  serverSlots: number;
  boosted: boolean;
  servers: string[];
  notified?: boolean;
  userID: string;
}
