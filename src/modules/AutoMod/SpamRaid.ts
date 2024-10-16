import { GuildTextableChannel, Message } from "eris";
import { GuildConfig } from "../../core/database/models/GuildConfig";
import AutoMod from ".";
import logger from "../../core/structs/Logger";
import Lockdowns from "../Lockdowns";

export class SetCollection<T> extends Set<T> {
  constructor(limit: number, offset: number) {
    super();
    this.limit = limit;
    this.offset = offset;
  }
  limit: number;
  offset: number;

  add(value: T) {
    if (this.limit <= this.size) {
      let i = this.limit + this.offset;
      const keys = [...this.values()];
      for (let x = 0; x < keys.length; x++) {
        if (i <= this.limit) break;
        i--;
        this.delete(keys[x]);
      }
    }
    super.add(value);
    return this;
  }
}

export enum ModeratedLevelsFlags {
  LEVEL1 = 1,
  LEVEL2 = 2,
  LEVEL3 = 4,
  LEVEL4 = 8,
  LEVEL5 = 16,
  UNKNOWN = 32,
}

export interface GuildCounter {
  messages: SetCollection<string>;
  timestamp: number;
  moderatedLevels: ModeratedLevelsFlags;
}

export class SpamRaid {
  counters = new Map<string, GuildCounter>();
  locks = new Set<string>();
  bans = new Map<string, number>();

  getFlagFromLvl(level: number) {
    if (level === 0) return ModeratedLevelsFlags.LEVEL1;
    else if (level === 1) return ModeratedLevelsFlags.LEVEL2;
    else if (level === 2) return ModeratedLevelsFlags.LEVEL3;
    else if (level === 3) return ModeratedLevelsFlags.LEVEL4;
    else if (level === 4) return ModeratedLevelsFlags.LEVEL5;
    else return ModeratedLevelsFlags.UNKNOWN;
  }

  async handleMessage(
    message: Message<GuildTextableChannel>,
    config: GuildConfig,
    automod: AutoMod
  ) {
    if (this.locks.has(message.guildID) || this.bans.has(message.guildID)) return;
    if (!config.isPremium || !config.automod || !config.automod.messageRaidLevels) return;

    const counter = this.counters.get(message.guildID);
    const now = Date.now();
    if (!counter) {
      this.counters.set(message.guildID, {
        messages: new SetCollection(60, 3),
        timestamp: now,
        moderatedLevels: 0,
      });
      return;
    }
    counter.messages.add(message.id);
    if (counter.messages.size < 5) return;

    const levels = config.automod.messageRaidLevels.sort((a, b) => b.maxMessages - a.maxMessages);
    const lvlIdx = levels.findIndex(
      (value, index) =>
        now - value.seconds * 1000 < counter.timestamp &&
        !(counter.moderatedLevels & this.getFlagFromLvl(index))
    );
    if (lvlIdx === -1) return;
    if (counter.moderatedLevels & this.getFlagFromLvl(lvlIdx)) return; // this level has already been moderated.

    const level = levels[lvlIdx];

    if (!level) return;
    this.locks.add(message.guildID);

    const selfMember = await automod.client.getSelfMember(message.channel.guild);
    if (!selfMember) {
      this.locks.delete(message.guildID);
      return;
    }

    let msg;
    try {
      msg = await automod.client.createMessage(message.channel.id, "Checking some things...");
    } catch (err) {
      logger.error("automod: spam raid: failed to create message", err);
    }

    if (!msg) {
      this.locks.delete(message.guildID);
      return;
    }

    const messages: string[] = [];
    let isError = false;
    if (level.slowmode && message.channel.permissionsOf(selfMember).has("manageChannels")) {
      await automod.client
        .editChannel(
          message.channel.id,
          { rateLimitPerUser: level.slowmode },
          `Spam raid triggered.`
        )
        .then(() => {
          messages.push(`Updated slowmode to ${level.slowmode}.`);
        })
        .catch((err) => {
          isError = true;
          messages.push(`Failed to update slowmode.`);
          logger.error("automod: spam raid: failed to edit channel slowmode", err);
        });
    }

    if (level.lockdownTime && level.lockdownTime > 60_000) {
      const lockdowns = automod.client.modules.get("Lockdowns") as Lockdowns;
      if (lockdowns !== undefined) {
        await lockdowns
          .lockdown(message.channel.guild, level.lockdownTime)
          .then(() => {
            messages.push("Server locked.");
          })
          .catch((err) => {
            isError = true;
            messages.push("Failed to lockdown server.");
            logger.error("automod: spam raid: failed to lock server", err);
          });
      }
    }

    if (messages.length > 0) {
      msg.edit(messages.join("\n")).catch((err) => {
        logger.error("automod: spam raid: failed to edit messasge", err);
      });
    } else {
      msg.edit("Nothing moderated.").catch((err) => {
        logger.error("automod: spam raid: failed to edit messasge", err);
      });
    }
    counter.moderatedLevels = counter.moderatedLevels | this.getFlagFromLvl(lvlIdx);
    counter.timestamp = Date.now();
    if (isError) {
      this.bans.set(message.guildID, Date.now() + 60_000 * 5); // 5 minute ban;
    }
    this.locks.delete(message.guildID);
    return true;
  }
}
