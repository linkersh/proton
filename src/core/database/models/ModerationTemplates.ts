import { PunishmentTypes } from "../../../Constants";

export interface ModerationTemplate {
  name: string;
  duration: number;
  actions: PunishmentTypes;
}
export interface ModerationTemplates {
  _id: string;
  templates: ModerationTemplate[];
}
