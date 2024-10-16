import logger from "../core/structs/Logger";
import ClientModule from "../core/structs/ClientModule";
import { GuildTextableChannel, Message, Role } from "eris";
import { GuildConfig, LevelReward } from "../core/database/models/GuildConfig";
import { collections } from "../core/database/DBClient";
import { highestRole } from "../utils/Util";
import { ProtonClient } from "../core/client/ProtonClient";
import { RateLimiter } from "../utils/RateLimiter";
import Parser from "./Parser";

export default class Levels extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Levels");
  }
  readonly ratelimits = new RateLimiter({
    maxPoints: 1,
    time: 60 * 1000,
    interval: true,
  });

  async handleMessage(message: Message<GuildTextableChannel>, config: GuildConfig) {
    if (!message.member || !config.levels || !config.levels.enabled) {
      return;
    }

    if (config.levels.ignored_roles) {
      if (config.levels.ignored_roles.find((r) => message.member.roles.includes(r))) {
        return;
      }
    }

    if (config.levels.ignored_channels) {
      if (config.levels.ignored_channels.includes(message.channel.id)) {
        return;
      }
    }

    if (!this.ratelimits.check(message.guildID + message.author.id)) {
      return;
    }

    const query = {
      guildID: message.guildID,
      userID: message.author.id,
    };
    let levelData;
    try {
      levelData = await collections.levels.findOne(query);
    } catch (err) {
      logger.error(
        `levels: failed to retrive level data for user: ${message.author.id} in guild: ${message.guildID}`,
        err
      );
      return;
    }

    const toAddXP = this.randXp() * (config.levels.xp_rate || 1);
    if (!levelData) {
      collections.levels
        .insertOne({
          guildID: message.guildID,
          userID: message.author.id,
          level: 0,
          xp: {
            total: toAddXP,
            current: toAddXP,
            required: 100,
          },
        })
        .catch((err) => {
          logger.error(
            `levels: failed to create new level for user: ${message.author.id} in guild: ${message.guildID}`,
            err
          );
        });
      return;
    }

    const newTotalXP = this.totalXp(levelData.level) + levelData.xp.current + toAddXP;
    if (levelData.xp.current + toAddXP > levelData.xp.required) {
      const newCurrentXP = toAddXP + levelData.xp.current - levelData.xp.required;
      const newLevel = levelData.level + 1;
      collections.levels
        .updateOne(query, {
          $set: {
            level: newLevel,
            xp: {
              total: newTotalXP,
              current: newCurrentXP,
              required: this.getTargetXp(newLevel),
            },
          },
        })
        .catch((err) => {
          logger.error(
            `levels: failed to level-up user: ${message.author.id} in guild: ${message.guildID}`,
            err
          );
        });
      // let rewardRole;
      let rewardedRole: Role | undefined;
      if (config.levels.rewards && config.levels.rewards.length > 0) {
        const selfMember = await this.client.getSelfMember(message.channel.guild);
        if (!selfMember) {
          logger.warn(`levels: couldn't retrive self member in guild: ${message.guildID}`);
          return;
        }

        if (selfMember.permissions?.has("manageRoles")) {
          const selfHighestRole = highestRole(selfMember, message.channel.guild);
          const rewards: LevelReward[] = [];
          let roles = message.member.roles ?? [];
          if (config.levels.rewards) {
            for (let x = 0; x < config.levels.rewards.length; x++) {
              const reward = config.levels.rewards[x];
              const guildRole = message.channel.guild.roles.get(reward.role_id);
              if (guildRole && guildRole.position < selfHighestRole.position) {
                rewards.push(reward);
              }
            }
          }
          if (config.levels.stack) {
            const addRole = rewards.find((r) => r.level === newLevel);
            if (addRole) {
              roles.push(addRole.role_id);
              rewardedRole = message.channel.guild.roles.get(addRole.role_id);
            }
            message.member.edit({ roles }).catch((err) => {
              logger.warn(
                `levels: failed to modify user roles, stack: true, guild id: ${message.guildID} user: ${message.author.id}`,
                err
              );
            });
          } else {
            roles = roles.filter((r) => r && !rewards.find((rw) => rw.role_id === r));
            const addRole = config.levels.rewards
              .sort((a, b) => b.level - a.level)
              .find((r) => r.level <= newLevel);
            if (addRole) {
              roles.push(addRole.role_id);
              rewardedRole = message.channel.guild.roles.get(addRole.role_id);
            }
            message.member.edit({ roles }).catch((err) => {
              logger.warn(
                `levels: failed to modify user roles, stack: false, guild id: ${message.guildID} user: ${message.author.id}`,
                err
              );
            });
          }
        }
      }

      if (config.levels.silent) {
        return;
      }

      const reward = rewardedRole
        ? {
            id: rewardedRole.id,
            name: rewardedRole.name,
            mention: `<@&${rewardedRole.id}>`,
          }
        : null;
      const tags = [
        [
          "user",
          {
            id: message.author.id,
            mention: message.author.mention,
            username: message.author.username,
            discriminator: message.author.discriminator,
            avatarURL: message.author.dynamicAvatarURL(undefined, 2048),
          },
        ],
        [
          "server",
          {
            id: message.channel.guild.id,
            name: message.channel.guild.name,
            iconURL: message.channel.guild.dynamicIconURL(undefined, 2048),
            ownerID: message.channel.guild.ownerID,
            memberCount: message.channel.guild.memberCount,
          },
        ],
        ["reward", reward],
        ["level", newLevel],
        ["oldLevel", newLevel - 1],
      ];
      const parser = this.client.modules.get("Parser") as Parser | undefined;
      if (!parser) {
        logger.error("levels: parser module not found");
        return;
      }

      const parsedMessage = parser.parse(
        config.levels.level_up_message ||
          "**{user:username}#{user:discriminator}** you have reached level **{level}**!",
        tags
      );
      const channel = message.channel.guild.channels.get(
        config.levels.level_up_channel || message.channel.id
      );
      if (!channel) {
        return;
      }

      const chPerms = channel.permissionsOf(this.client.user.id);
      if (!chPerms || !chPerms.has("viewChannel") || !chPerms.has("sendMessages")) {
        return;
      }
      if (parsedMessage && parsedMessage.length) {
        this.client
          .createMessage(channel.id, {
            content: parsedMessage.toString(),
            allowedMentions: { users: true },
          })
          .catch((err) => logger.warn(`levels: failed to create message`, err));
      }
    } else {
      collections.levels
        .updateOne(query, {
          $inc: { "xp.current": toAddXP },
          $set: { "xp.total": newTotalXP },
        })
        .catch((err) => {
          logger.error(
            `levels: failed to update user xp, guild id: ${message.guildID}, user id: ${message.author.id}`,
            err
          );
        });
    }
  }

  randXp() {
    return Math.floor(Math.random() * 10) + 15;
  }

  totalXp(level: number) {
    if (!level || !Number.isInteger(level)) {
      return 0;
    }
    let totalXp = 0;
    for (let i = 0; i < level; i++) {
      totalXp += this.getTargetXp(i);
    }
    return totalXp;
  }

  getTargetXp(level: number) {
    return 5 * Math.pow(level, 2) + 50 * level + 100; // Thanks MEE6 for the formula :)
  }
}
