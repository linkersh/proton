import { MongoClient } from "mongodb";
import { config } from "../../Config";
import { Case } from "./models/Case";
import { CommandLog } from "./models/CommandLog";
import { Commands } from "./models/Commands";
import { CommandStats } from "./models/CommandStats";
import { GuildConfig } from "./models/GuildConfig";
import { Level } from "./models/Levels";
import { ServerLockdown } from "./models/Lockdown";
import { Message } from "./models/Message";
import { ModerationStructure } from "./models/Moderation";
import { ModerationTemplates } from "./models/ModerationTemplates";
import { ReactionRoles } from "./models/ReactionRoles";
import { Reminder } from "./models/Reminder";
import { Reputation } from "./models/Reputation";
import { StarboardMessage } from "./models/StarboardMessage";
import { Tag } from "./models/Tag";
import { Subscriptions } from "./models/Subscription";
import { TimeoutRoles } from "./models/TimeoutRoles";
import { QuarantinedGuild } from "./models/QuarantinedGuild";
import { EventStats } from "./models/EventStats";
import { ModStats } from "./models/ModStats";
import { ComponentRoles } from "./models/ComponentRoles";
import { ScriptData } from "./models/ScriptData";

const client = new MongoClient(config.secret.mongoUri, {
  authSource: config.mongodbOptions.authSource ?? undefined,
  auth: config.mongodbOptions.auth ?? undefined,
});

const db = client.db(config.mongodbOptions.dbName);
const collections = {
  guildconfigs: db.collection<GuildConfig>("guildconfigs"),
  cases: db.collection<Case>("cases"),
  moderations: db.collection<ModerationStructure>("moderations"),
  command_configs: db.collection<Commands>("commands"),
  levels: db.collection<Level>("levels"),
  starboard_messages: db.collection<StarboardMessage>("starboard_messages"),
  reaction_roles: db.collection<ReactionRoles>("reaction_roles"),
  messages: db.collection<Message>("messages"),
  reminders: db.collection<Reminder>("reminders"),
  reputation: db.collection<Reputation>("reputation"),
  lockdowns: db.collection<ServerLockdown>("lockdowns"),
  command_logs: db.collection<CommandLog>("command_logs"),
  command_stats: db.collection<CommandStats>("command_stats"),
  event_stats: db.collection<EventStats>("event_stats"),
  tags: db.collection<Tag>("tags"),
  moderation_templates: db.collection<ModerationTemplates>("moderation_templates"),
  subscriptions: db.collection<Subscriptions>("subscriptions"),
  timeout_roles: db.collection<TimeoutRoles>("autoroles"),
  quarantined_guilds: db.collection<QuarantinedGuild>("quarantined_guilds"),
  mod_stats: db.collection<ModStats>("mod_stats"),
  component_roles: db.collection<ComponentRoles>("component_roles"),
  script_data: db.collection<ScriptData>("script_data"),
};

export { client, db, collections };
