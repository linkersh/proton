import { ClientOptions } from "eris";
import { Auth } from "mongodb";

export interface MongodbOptions {
  dbName: string;
  authSource: string | null;
  auth: Auth | null;
}

export interface Secret {
  mongoUri: string;
  googleApi: string;
  serverPort: number;
  token: string;
}

export interface Config {
  clientOptions: ClientOptions;
  mongodbOptions: MongodbOptions;
  secret: Secret;
  testGuild: string;
  admins: string[];
}
