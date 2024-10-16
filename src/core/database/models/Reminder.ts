export interface ReminderData {
  duration: number;
  endsAt: number;
  id: number;
  topic: string;
}
export interface Reminder {
  userID: string;
  data: ReminderData[];
  reminderID: number;
}
