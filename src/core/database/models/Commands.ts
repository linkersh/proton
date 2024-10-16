export interface Command {
  dmMessage?: string;
  disabled?: boolean;
  allowedRoles?: string[];
  disallowedRoles?: string[];
  permissions?: string[];
  allowMods?: boolean;
}

export interface Commands {
  _id?: string;
  commands: { [key: string]: Command };
}
