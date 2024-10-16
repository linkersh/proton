import { Constants, Guild } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";

export default class Lockdowns extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Lockdowns");
    this.startTimer();
    Lockdowns.LockdownDeny |= Constants.Permissions.voiceConnect;
    Lockdowns.LockdownDeny |= Constants.Permissions.sendMessages;
    Lockdowns.LockdownDeny |= Constants.Permissions.sendMessagesInThreads;
    Lockdowns.LockdownDeny |= Constants.Permissions.createPublicThreads;
    Lockdowns.LockdownDeny |= Constants.Permissions.createPrivateThreads;
  }
  static LockdownDeny = 0n;
  static RequiredLockdownPerms = [
    "sendMessages",
    "sendMessagesInThreads",
    "createPublicThreads",
    "createPrivateThreads",
    "manageRoles",
  ];
  static LockdownError = class extends Error {
    constructor(message: string) {
      super(message);
    }
  };
  timer?: NodeJS.Timeout;

  startTimer() {
    this.timer = setInterval(() => {
      this.check().catch((err) =>
        logger.error("lockdowns: failed to check for expired lockdowns", err)
      );
    }, 60_000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async check() {
    const now = new Date(Date.now());
    let toUnlock;
    try {
      toUnlock = await collections.lockdowns.find({ unlocksAt: now }).toArray();
    } catch (err) {
      logger.error("lockdowns: failed to find expired lockdowns", err);
    }
    if (!toUnlock || toUnlock.length === 0) {
      return;
    }
    const moderated: string[] = [];
    for (let x = 0; x < toUnlock.length; x++) {
      const server = toUnlock[x];
      if (moderated.includes(server.guildID)) {
        continue;
      }
      const guild = this.client.guilds.get(server.guildID);
      if (!guild) {
        continue;
      }
      if (!guild.permissionsOf(this.client.user.id)?.has("manageRoles")) {
        continue;
      }
      this.unlockdown(guild, false).catch((err) => {
        logger.error("lockdowns: failed to unlock server", err);
      });
      moderated.push(guild.id);
    }
    collections.lockdowns.deleteMany({ guildID: { $in: moderated } }).catch((err) => {
      logger.error("lockdowns: failed to delete expired lockdowns", err);
    });
  }

  async lockdown(guild: Guild, duration: number) {
    if (duration < 60 * 1000) {
      throw new Lockdowns.LockdownError("Duration needs to at least be a minute long.");
    }
    if (duration > 6.048e8) {
      throw new Lockdowns.LockdownError("Duration cannot be longer than 7 days.");
    }
    if (!guild.permissionsOf(this.client.user.id)?.has("manageRoles")) {
      throw new Lockdowns.LockdownError("I need the manage roles permission.");
    }

    const everyone = guild.roles.get(guild.id);
    if (!everyone) {
      throw new Lockdowns.LockdownError("Cannot find the @everyone role");
    }
    const allowRole = everyone.permissions.allow || 0n;
    const perms = allowRole & ~Lockdowns.LockdownDeny;

    await this.client.editRole(guild.id, everyone.id, { permissions: perms });
    await collections.lockdowns.insertOne({
      guildID: guild.id,
      unlocksAt: new Date(Date.now() + duration),
    });
  }

  async unlockdown(guild: Guild, deleteData = false) {
    const everyone = guild.roles.get(guild.id);
    if (!everyone) {
      throw new Lockdowns.LockdownError("Cannot find the @everyone role");
    }
    const perms = everyone.permissions.allow | Lockdowns.LockdownDeny;
    await this.client.editRole(guild.id, everyone.id, { permissions: perms });
    if (deleteData) {
      try {
        await collections.lockdowns.deleteMany({ guildID: guild.id });
      } catch (err) {
        logger.error("lockdowns: failed to delete lockdown(s)", err);
      }
    }
  }
}
