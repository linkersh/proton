export enum StoredDataTypes {
  NUMBER,
  BOOLEAN,
  NULL,
  STRING,
}

export interface ScriptData {
  guild_id: string;
  key: string;
  value: string;
  data_type: StoredDataTypes;
}
