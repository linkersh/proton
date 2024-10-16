import ClientModule from "../core/structs/ClientModule";
import ModlogBuilder from "../utils/ModlogBuilder";
import logger from "../core/structs/Logger";
import Parser from "./Parser";
import Stats from "./Stats";
import { Guild, Member, User } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { getTag, highestRole } from "../utils/Util";
import { Case, CaseStructure } from "../core/database/models/Case";
import { GuildConfig } from "../core/database/models/GuildConfig";
import { collections } from "../core/database/DBClient";
import { ModerationTypes, PunishmentTypes } from "../Constants";
import { SendDMData } from "../interfaces/SendDMData";
import { Moderation as ModerationSchema } from "../core/database/models/Moderation";
import { ObjectId } from "bson";

interface TempModerationsData {
  _id: string;
  moderations: ModerationSchema[];
  guildConfig: GuildConfig | null;
}

export default class Moderation extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Moderation");
    setInterval(() => {
      this.checkTempModerations();
    }, 80_000);
  }

  async checkTempModerations() {
    const now = Date.now();
    let data: TempModerationsData[] | undefined;
    try {
      data = (await collections.moderations
        .aggregate([
          {
            $match: {
              expiresAt: { $lt: new Date(now) },
              type: {
                $in: [ModerationTypes.TEMPMUTE, ModerationTypes.BAN],
              },
            },
          },
          {
            $group: {
              _id: "$guildID",
              moderations: { $push: "$$ROOT" },
            },
          },
          {
            $lookup: {
              from: "guildconfigs",
              localField: "_id",
              foreignField: "_id",
              as: "guildConfig",
            },
          },
          {
            $unwind: {
              path: "$guildConfig",
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .toArray()) as TempModerationsData[];
    } catch (err) {
      logger.error("moderation: failed to fetch moderations", err);
    }
    if (!data) {
      return;
    }

    const toDelete: string[] = [];
    for (let ii = 0; ii < data.length; ii++) {
      const group = data[ii];
      if (!group.guildConfig) {
        toDelete.push(...group.moderations.map((x) => x._id));
        continue;
      }

      const guild = await this.client.getGuild(group._id);
      if (!guild) {
        toDelete.push(...group.moderations.map((x) => x._id));
        continue;
      }

      for (let x = 0; x < group.moderations.length; x++) {
        const moderation = group.moderations[x];
        if (moderation.type === ModerationTypes.TEMPMUTE) {
          if (!group.guildConfig.moderation || !group.guildConfig.moderation.muterole) {
            toDelete.push(moderation._id);
            continue;
          }
          const role = guild.roles.get(group.guildConfig.moderation?.muterole);
          const selfMember = await this.client.getSelfMember(guild);
          if (!role || !selfMember) {
            toDelete.push(moderation._id);
            continue;
          }
          if (role.position >= highestRole(selfMember, guild).position) {
            toDelete.push(moderation._id);
            continue;
          }

          const member = await this.client.getMember(moderation.userID, guild);
          if (!member) {
            toDelete.push(moderation._id);
            continue;
          }
          this.unmuteUser(guild, member, selfMember.user, group.guildConfig, "Time is up.").catch(
            (err) => logger.error("moderation: failed to un-mute user", err)
          );
        } else if (moderation.type === ModerationTypes.BAN) {
          const user = await this.getUser(moderation.userID);
          if (!user) {
            toDelete.push(moderation._id);
            continue;
          }
          this.unbanUser(guild, user, this.client.user, "Time is up.").catch((err) =>
            logger.error("moderation: failed to un-ban user", err)
          );
        }
        toDelete.push(moderation._id);
      }
      collections.moderations
        .deleteMany({ _id: { $in: toDelete as unknown as ObjectId[] } })
        .catch((err) => {
          logger.error("moderation: failed to delete moderations", err);
        });
    }
  }

  async canPunish(guild: Guild, moderator: Member, target: Member, word: string) {
    if (moderator.id === target.id) {
      if (word === "kick" || word.includes("ban")) {
        return "Just press the leave server button.";
      } else {
        return `You cannot ${word} yourself.`;
      }
    }
    const highestRoleMod = highestRole(moderator, guild);
    const highestRoleUsr = highestRole(target, guild);
    const selfMem = await this.client.getSelfMember(guild);
    if (selfMem === undefined) {
      return `Error fetching self member.`;
    }

    const highestRoleMe = highestRole(selfMem, guild);
    if (highestRoleMod.position <= highestRoleUsr.position && moderator.id !== guild.ownerID) {
      return `You can't ${word} that member because your role is not high enough.`;
    }
    if (
      highestRoleMe.position <= highestRoleUsr.position &&
      !["mute", "unmute", "warn"].includes(word)
    ) {
      return `I can't ${word} that member because my role is too low.`;
    }
    if (target.id === this.client.user.id && word !== "unmute") {
      return "Why are you doing this to me :(";
    }
    if (target.id === guild.ownerID) {
      return `Thats so sus, why would you want to ${word} the owner.`;
    }
    return "";
  }

  getUser(id: string): Promise<User | null> {
    return new Promise((resolve) => {
      const user = this.client.users.get(id);
      if (user) {
        return resolve(user);
      }
      this.client
        .getRESTUser(id)
        .then((u) => {
          if (u) {
            this.client.users.add(u, this.client, true);
          }
          return resolve(u);
        })
        .catch(() => resolve(null));
    });
  }

  sendDM(userID: string, data: SendDMData) {
    const { dmMessage, user, guild, moderator, reason } = data;
    const tags = [
      [
        "user",
        {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          tag: getTag(user),
        },
      ],
      [
        "server",
        {
          id: guild.id,
          name: guild.name,
        },
      ],
      [
        "moderator",
        {
          id: moderator.id,
          username: moderator.username,
          discriminator: moderator.discriminator,
          tag: getTag(moderator),
        },
      ],
      ["reason", reason || "no reason"],
    ];

    const parser = this.client.modules.get("Parser") as Parser | undefined;
    if (!parser) {
      logger.warn(`moderation: send dm: parser module is not loaded`);
      return;
    }

    let parsed = "";
    try {
      parsed = parser.parse(dmMessage, tags);
    } catch (err) {
      logger.error(`moderation: send dm: failed to parse dm message`, err);
      return;
    }
    if (parsed && parsed.length > 0) {
      this.client
        .getDMChannel(userID)
        .then((ch) => ch.createMessage(parsed))
        .catch((err) => logger.error("moderation: send dm: failed to dm user", err));
    }
  }

  sendModlog(logData: Case, config: GuildConfig) {
    return new Promise((resolve, reject) => {
      if (!config.moderation || !config.moderation.log_channel) {
        return reject(new Error("No log channel."));
      }
      const guild = this.client.guilds.get(logData.guild_id);
      if (!guild) {
        return reject(new Error("Guild not found"));
      }
      const logChannel = guild.channels.get(config.moderation.log_channel);
      if (!logChannel) {
        return reject(new Error("No log channel."));
      }

      const builder = new ModlogBuilder();
      const embed = builder
        .id(logData.id)
        .action(logData.type)
        .duration(logData.duration || 0)
        .moderator(logData.moderator)
        .target(logData.user)
        .reason(logData.reason)
        .build();
      this.client
        .createMessage(logChannel.id, { embeds: [embed] })
        .then(resolve)
        .catch(reject);
    });
  }

  createCase(data: CaseStructure): Promise<Case[]>;
  createCase(data: CaseStructure[]): Promise<Case[]>;
  createCase(data: CaseStructure | CaseStructure[]): Promise<Case[]> {
    return new Promise((resolve, reject) => {
      const caseData = Array.isArray(data) ? data : [data];
      if (caseData.length === 0) {
        reject(new Error("No cases specified"));
      }
      collections.guildconfigs
        .findOneAndUpdate(
          { _id: caseData[0].guild_id },
          {
            $inc: { "moderation.case_count": caseData.length },
            $setOnInsert: { prefixes: ["-"] },
          },
          {
            returnDocument: "after",
            projection: {
              "moderation.case_count": 1,
              "moderation.log_channel": 1,
              _id: 0,
            },
            upsert: true,
          }
        )
        .then((config) => {
          if (!config.value) {
            resolve([]);
            return;
          }
          const cases: Case[] = [];
          let newID = Number(config.value.moderation?.case_count) || 0;
          if (newID > 0) {
            newID -= caseData.length;
          }
          for (let x = 0; x < caseData.length; x++) {
            newID++;
            const obj = caseData[x] as Case;
            obj.created_at = new Date();
            obj.id = newID;
            cases.push(obj);
            this.sendModlog(obj, config.value).catch((err) => {
              logger.warn(`moderation: failed to create modlog`, err);
            });
          }
          collections.cases
            .insertMany(cases)
            .then(() => resolve(cases))
            .catch(reject);
        })
        .catch(reject);
    });
  }

  createModeration(guildID: string, userID: string, type: ModerationTypes, duration: number) {
    return collections.moderations.insertOne({
      guildID: guildID,
      userID: userID,
      type: type,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + duration),
    });
  }

  deleteModeration(guildID: string, userID: string, types: ModerationTypes[]) {
    return collections.moderations.deleteMany({
      guildID: guildID,
      userID: userID,
      type: { $in: types },
    });
  }

  warnUser(guild: Guild, user: User, moderator: User, config: GuildConfig, reason = "") {
    if (config.isPremium && config.moderation && config.moderation.dmWarns) {
      const dmMsg =
        config.commands?.warn?.dmMessage ||
        `You have been warned in **{server:name}**, reason: {reason}`;
      this.sendDM(user.id, {
        dmMessage: dmMsg,
        user: user,
        guild: guild,
        moderator: moderator,
        reason: reason,
      });
    }

    const stats = this.client.modules.get("Stats") as Stats | undefined;
    if (stats) {
      stats.mods.warns += 1;
    }
    const caseData: CaseStructure = {
      guild_id: guild.id,
      reason: reason,
      type: PunishmentTypes.WARN,
      duration: 0,
      user: {
        username: user.username,
        discriminator: user.discriminator,
        id: user.id,
        avatar_url: user.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        username: moderator.username,
        discriminator: moderator.discriminator,
        id: moderator.id,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };
    return caseData;
  }

  async kickUser(guild: Guild, member: Member, moderator: User, config: GuildConfig, reason = "") {
    if (config.isPremium && config.moderation && config.moderation.dmKicks) {
      const dmMsg =
        config.commands?.kick?.dmMessage ||
        `You have been kicked in **{server:name}**, reason: {reason}`;
      this.sendDM(member.id, {
        dmMessage: dmMsg,
        user: member.user,
        guild: guild,
        moderator: moderator,
        reason: reason,
      });
    }
    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) {
      throw new Error("Cannot find self member.");
    }
    if (!guild.permissionsOf(selfMember).has("kickMembers")) {
      throw new Error("Missing kick members permission.");
    }
    if (highestRole(member, guild).position >= highestRole(selfMember, guild).position) {
      throw new Error("Cannot kick member due to role hierarchy.");
    }
    await this.client.kickGuildMember(
      guild.id,
      member.id,
      encodeURIComponent(`${reason} - kicked by ${getTag(moderator)}`)
    );
    const kickCase: CaseStructure = {
      guild_id: guild.id,
      type: PunishmentTypes.KICK,
      reason: reason,
      duration: 0,
      user: {
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar_url: member.user.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        id: moderator.id,
        username: moderator.username,
        discriminator: moderator.discriminator,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };

    const stats = this.client.modules.get("Stats") as Stats | undefined;
    if (stats) {
      stats.mods.kicks += 1;
    }
    return kickCase;
  }

  async timeoutUser(guild: Guild, user: User, moderator: User, reason: string, duration: number) {
    await this.client.editGuildMember(
      guild.id,
      user.id,
      {
        communicationDisabledUntil: new Date(Date.now() + duration),
      },
      encodeURIComponent(`${reason} - timed out by: ${getTag(moderator)}`)
    );
    const timeoutCase: CaseStructure = {
      type: PunishmentTypes.TIMEOUT,
      guild_id: guild.id,
      duration: duration,
      reason: reason,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar_url: user.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        id: moderator.id,
        username: moderator.username,
        discriminator: moderator.discriminator,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };
    return timeoutCase;
  }

  async muteUser(
    guild: Guild,
    member: Member,
    moderator: User,
    config: GuildConfig,
    duration: number,
    reason: string
  ) {
    if (!config.moderation || !config.moderation.muterole) {
      throw new Error("No muterole setup.");
    }
    if (member.roles.includes(config.moderation.muterole)) {
      throw new Error("Member is already muted.");
    }
    if (!guild.permissionsOf(this.client.user.id).has("manageRoles")) {
      throw new Error("Client doesn't have manage roles permission.");
    }

    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) {
      throw new Error("Self member not found.");
    }
    const role = guild.roles.get(config.moderation.muterole);
    if (!role) {
      throw new Error("The mute role has been deleted.");
    }
    if (role.position >= highestRole(selfMember, guild).position) {
      throw new Error("Cannot assign mute-role due to role hierarchy.");
    }

    if (config.isPremium && config.moderation?.dmMutes) {
      const dmMsg =
        config.commands?.mute?.dmMessage ||
        `You have been muted in **{server:name}**, reason: {reason}`;
      this.sendDM(member.id, {
        dmMessage: dmMsg,
        user: member.user,
        guild: guild,
        moderator: moderator,
        reason: reason,
      });
    }
    await this.client.addGuildMemberRole(
      guild.id,
      member.id,
      role.id,
      encodeURIComponent(`${reason} - muted by ${getTag(moderator)}`)
    );

    if (duration && duration > 0) {
      this.createModeration(guild.id, member.id, ModerationTypes.TEMPMUTE, duration);
    } else {
      this.createModeration(guild.id, member.id, ModerationTypes.MUTE, duration);
    }
    const muteCase: CaseStructure = {
      type: PunishmentTypes.MUTE,
      guild_id: guild.id,
      reason: reason,
      duration: duration || 0,
      user: {
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar_url: member.user.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        id: moderator.id,
        username: moderator.username,
        discriminator: moderator.discriminator,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };

    const stats = this.client.modules.get("Stats") as Stats | undefined;
    if (stats) {
      stats.mods.mutes += 1;
    }
    return muteCase;
  }

  async unmuteUser(
    guild: Guild,
    member: Member,
    moderator: User,
    config: GuildConfig,
    reason: string
  ) {
    if (!config.moderation || !config.moderation.muterole) {
      throw new Error("No muterole setup.");
    }
    if (!member.roles.includes(config.moderation.muterole)) {
      throw new Error("Member is not muted.");
    }
    if (!guild.permissionsOf(this.client.user.id).has("manageRoles")) {
      throw new Error("Client doesn't have manage roles permission.");
    }

    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) {
      throw new Error("Self member not found.");
    }
    const role = guild.roles.get(config.moderation.muterole);
    if (!role) {
      throw new Error("The mute role has been deleted.");
    }
    if (role.position >= highestRole(selfMember, guild).position) {
      throw new Error("Cannot remove mute-role due to role hierarchy.");
    }

    if (config.isPremium && config.moderation?.dmMutes) {
      const dmMsg =
        config.commands?.unmute?.dmMessage ||
        `You have been un-muted in **{server:name}**, reason: {reason}`;
      this.sendDM(member.id, {
        dmMessage: dmMsg,
        user: member.user,
        guild: guild,
        moderator: moderator,
        reason: reason,
      });
    }
    await this.client.removeGuildMemberRole(
      guild.id,
      member.id,
      role.id,
      encodeURIComponent(`${reason} - un-muted by ${getTag(moderator)}`)
    );

    this.deleteModeration(guild.id, member.id, [
      ModerationTypes.TEMPMUTE,
      ModerationTypes.MUTE,
      ModerationTypes.BAN,
    ]).catch((err) =>
      logger.error(
        "moderation: un-mute user: failed to delete pending temp-mute/mute/ban moderations",
        err
      )
    );

    const muteCase: CaseStructure = {
      type: PunishmentTypes.UNMUTE,
      guild_id: guild.id,
      reason: reason,
      duration: 0,
      user: {
        id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar_url: member.user.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        id: moderator.id,
        username: moderator.username,
        discriminator: moderator.discriminator,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };

    return muteCase;
  }

  async banUser(
    guild: Guild,
    member: User,
    moderator: User,
    config: GuildConfig,
    duration: number,
    reason: string,
    deleteDays = 0,
    outsideGuild = false
  ) {
    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) {
      throw new Error("Cannot find self member.");
    }
    if (!guild.permissionsOf(selfMember).has("banMembers")) {
      throw new Error("Client doesn't have ban members permission.");
    }
    /*const highestRoleUser = highestRole(member, guild);
      if (!outsideGuild) {
         if (highestRoleUser.position >= highestRole(selfMember, guild).position) {
            throw new Error("Cannot ban the member due to role hierarchy.");
         }
      }*/
    if (!outsideGuild && config.isPremium && config.moderation && config.moderation.dmBans) {
      const dmMsg =
        config?.commands?.ban?.dmMessage ||
        `You have been banned in **{server:name}**, reason: {reason}`;
      this.sendDM(member.id, {
        dmMessage: dmMsg,
        user: member,
        guild: guild,
        moderator: moderator,
        reason: reason,
      });
    }
    await this.client.banGuildMember(
      guild.id,
      member.id,
      deleteDays,
      encodeURIComponent(`${reason} - banned by: ${getTag(moderator)}`)
    );

    const banCase: CaseStructure = {
      guild_id: guild.id,
      type: PunishmentTypes.BAN,
      reason: reason,
      duration: duration,
      user: {
        id: member.id,
        username: member.username,
        discriminator: member.discriminator,
        avatar_url: member.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        id: moderator.id,
        username: moderator.username,
        discriminator: moderator.discriminator,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };

    if (duration && duration > 0) {
      await this.createModeration(guild.id, member.id, ModerationTypes.BAN, duration);
    }

    const stats = this.client.modules.get("Stats") as Stats | undefined;
    if (stats) {
      stats.mods.bans += 1;
    }
    return banCase;
  }

  async unbanUser(guild: Guild, user: User, moderator: User, reason: string) {
    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) {
      throw new Error("Cannot find self member.");
    }
    if (!guild.permissionsOf(selfMember).has("banMembers")) {
      throw new Error("Client doesn't have ban members permission.");
    }
    await this.client.unbanGuildMember(
      guild.id,
      user.id,
      encodeURIComponent(`${reason} - un-banned by: ${getTag(moderator)}`)
    );
    const unbanCase: CaseStructure = {
      guild_id: guild.id,
      type: PunishmentTypes.UNBAN,
      reason: reason,
      duration: 0,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar_url: user.dynamicAvatarURL(undefined, 256),
      },
      moderator: {
        id: moderator.id,
        username: moderator.username,
        discriminator: moderator.discriminator,
        avatar_url: moderator.dynamicAvatarURL(undefined, 256),
      },
    };

    this.deleteModeration(guild.id, user.id, [ModerationTypes.BAN]).catch((err) =>
      logger.error("moderation: un-ban user: failed to delete pending ban moderations", err)
    );
    return unbanCase;
  }

  async warnWithThresholds(
    guild: Guild,
    member: Member,
    moderator: User,
    reason: string,
    config: GuildConfig
  ): Promise<CaseStructure[]> {
    if (
      config.automod &&
      config.automod.warnThresholds &&
      config.automod.warnThresholds.length > 0
    ) {
      const warns = await collections.cases.countDocuments({
        guild_id: guild.id,
        "user.id": member.id,
        type: PunishmentTypes.WARN,
      });
      const thresholds = config.automod.warnThresholds.sort((a, b) => b.warnCount - a.warnCount);
      const exceededThreshold = thresholds.find((thresh) => thresh.warnCount <= warns + 1);
      if (exceededThreshold !== undefined) {
        const cases: CaseStructure[] = [];
        switch (exceededThreshold.action) {
          case PunishmentTypes.WARN:
            cases.push(this.warnUser(guild, member.user, moderator, config, reason));
            break;
          case PunishmentTypes.MUTE:
            cases.push(
              await this.muteUser(
                guild,
                member,
                moderator,
                config,
                exceededThreshold.duration || 0,
                reason
              )
            );
            break;
          case PunishmentTypes.KICK:
            cases.push(await this.kickUser(guild, member, moderator, config, reason));
            break;
          case PunishmentTypes.BAN:
            cases.push(
              await this.banUser(
                guild,
                member.user,
                moderator,
                config,
                exceededThreshold.duration || 0,
                reason,
                0,
                false
              )
            );
            break;
        }
        return cases;
      }
    }
    return [this.warnUser(guild, member.user, moderator, config, reason)];
  }
}
