import ClientCommand from "../structs/ClientCommand";
import CommandHandler from "../handlers/CommandHandler";
import EventHandler from "../handlers/EventHandler";
import ClientModule from "../structs/ClientModule";
import ModuleHandler from "../handlers/ModuleHandler";
import logger from "../structs/Logger";
import BanListCache from "../../utils/BanListCache";
import LegacyCommandHandler from "../handlers/LegacyCommandHandler";
import CachesManager from "../structs/CachesManager";
import { Client, ClientEvents, ClientOptions, Guild, Member, User } from "eris";
import { GuildConfig } from "../database/models/GuildConfig";
import { collections } from "../database/DBClient";
import { ChangeStreams } from "../database/ChangeStreams";
import { ReactionRoles } from "../database/models/ReactionRoles";
import { HandleMessageFunction } from "../../utils/MessageListener";
import { LegacyCommandManager } from "../structs/LegacyCommandManager";
import { FontHandler } from "../handlers/FontHandler";
import { CallBackFunction } from "../../utils/ComponentListener";

export class ProtonClient extends Client {
  constructor(token: string, options?: ClientOptions) {
    super(token, options);
  }
  readonly changeStreams = new ChangeStreams(this);
  readonly banListCache = new BanListCache(this);
  readonly cachesManager = new CachesManager(this);
  readonly legacyCommands = new LegacyCommandManager();
  readonly commands = new Map<string, ClientCommand>();
  readonly modules = new Map<string, ClientModule>();
  readonly guildConfigCache = new Map<string, GuildConfig>();
  readonly reactionRolesCache = new Map<string, ReactionRoles>();
  readonly componentListeners = new Map<string, CallBackFunction[]>();
  readonly aliases = new Map<string, string>();
  readonly messageListeners = new Map<string, HandleMessageFunction[]>();
  readonly purgeTasks = new Map<string, undefined>();
  readonly events = new Map<keyof ClientEvents, number>();
  readonly cmdStats = new Map<string, number>();

  loadEvents() {
    return EventHandler.load(this);
  }

  loadCommands() {
    return CommandHandler.load(this);
  }

  loadModules() {
    return ModuleHandler.load(this);
  }

  loadLegacyCommands() {
    return LegacyCommandHandler.load(this);
  }

  loadFonts() {
    return FontHandler.load();
  }

  getSelfMember(guild: Guild): Promise<Member | undefined> {
    return new Promise((resolve) => {
      if (guild.members.has(this.user.id)) {
        resolve(guild.members.get(this.user.id));
      } else {
        this.getRESTGuildMember(guild.id, this.user.id)
          .then((member) => {
            guild.members.add(member, guild, true);
            resolve(member);
          })
          .catch((err) => {
            logger.error(`failed to fetch self member in guild: ${guild.id}`, err);
            resolve(undefined);
          });
      }
    });
  }

  getUser(id: string): Promise<User | null> {
    return new Promise((resolve) => {
      const user = this.users.get(id);
      if (user) {
        return resolve(user);
      }
      this.getRESTUser(id)
        .then((u) => {
          if (u) {
            this.users.add(u, this, true);
          }
          return resolve(u);
        })
        .catch(() => resolve(null));
    });
  }

  getGuild(id: string): Promise<Guild | undefined> {
    return new Promise((resolve) => {
      const fromCache = this.guilds.get(id);
      if (fromCache) {
        resolve(fromCache);
        return;
      }
      this.getRESTGuild(id, false)
        .then((guild) => {
          this.guilds.add(guild, this, true);
          resolve(guild);
        })
        .catch(() => resolve(undefined));
    });
  }

  getMember(id: string, guild: Guild): Promise<Member | undefined> {
    return new Promise((resolve) => {
      if (guild.members.has(id)) {
        resolve(guild.members.get(id));
      } else {
        this.getRESTGuildMember(guild.id, id)
          .then((value) => {
            guild.members.add(value, guild, true);
            resolve(value);
          })
          .catch(() => {
            resolve(undefined);
          });
      }
    });
  }

  getGuildConfig(id: string): Promise<GuildConfig | undefined> {
    return new Promise((resolve, reject) => {
      const cachedConf = this.guildConfigCache.get(id);
      if (cachedConf !== undefined) {
        resolve(cachedConf);
        return;
      }
      collections.guildconfigs
        .aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: "commands",
              localField: "_id",
              foreignField: "_id",
              as: "commands",
            },
          },
          {
            $unwind: {
              path: "$commands",
              preserveNullAndEmptyArrays: true,
            },
          },
          { $addFields: { commands: "$commands.commands" } },
        ])
        .toArray()
        .then((value) => {
          if (value && value.length > 0) {
            this.guildConfigCache.set(value[0]._id, value[0] as GuildConfig);
            resolve(value[0] as GuildConfig);
          } else {
            const doc = { _id: id, prefixes: ["-"] };
            collections.guildconfigs
              .insertOne(doc)
              .then(() => resolve(doc))
              .catch(() => resolve(undefined));
          }
        })
        .catch(reject);
    });
  }

  getReactionRoles(guildID: string, messageID: string): Promise<ReactionRoles | undefined | null> {
    return new Promise((resolve, reject) => {
      if (this.reactionRolesCache.has(messageID)) {
        resolve(this.reactionRolesCache.get(messageID));
      } else {
        collections.reaction_roles
          .findOne({ guildID, messageID })
          .then((data) => {
            if (data) {
              this.reactionRolesCache.set(messageID, data);
            }
            resolve(data);
          })
          .catch(reject);
      }
    });
  }
}
