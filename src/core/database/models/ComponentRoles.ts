import { Constants } from "eris";

export enum ButtonRolesDataFlags {
  NORMAL = 1,
  REVERSE = 2,
}

export interface ButtonRoleData {
  component_type: Constants["ComponentTypes"]["BUTTON"];
  component_id: string;
  role_ids: string[];
  role_access_list?: string[];
  flags: ButtonRolesDataFlags;
}

export type ComponentRolesData = ButtonRoleData;

export interface ComponentRoles {
  guild_id: string;
  channel_id: string;
  message_id: string;
  components: ComponentRolesData[];
}
