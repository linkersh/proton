import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import AutoMod from "../modules/AutoMod";
import Moderation from "../modules/Moderation";
import Parser from "../modules/Parser";
import GuildLogger from "../modules/ServerLogger";
import { Constants } from "eris";
import { AntiAltsActions, AutoRoleTypes, ModerationTypes } from "../Constants";
import { collections } from "../core/database/DBClient";
import { getTag, highestRole } from "../utils/Util";

export default new ClientEvent("guildMemberAdd", async (client, guild, member) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.gateway.guildMemberAdd(guild, member);
  } else {
    logger.warn("guild member add: couldn't find the guild logger module");
  }

  const guildConfig = await client.getGuildConfig(guild.id);
  if (!guildConfig) return;

  const moderation = client.modules.get("Moderation") as Moderation | undefined;
  if (guildConfig.isPremium && guildConfig.automod && moderation) {
    const antiAlt = guildConfig.automod.antiAlts;
    if (antiAlt && antiAlt.minAge && antiAlt.action) {
      const minAge = antiAlt.minAge;
      const timeFrame = Math.floor(Date.now() - member.user.createdAt);
      if (timeFrame <= minAge) {
        const reason = `Account age: \`${Math.floor(timeFrame / 8.64e7)} days\` is too low!`;
        let caseData;
        switch (antiAlt.action) {
          case AntiAltsActions.BAN: {
            caseData = await moderation
              .banUser(guild, member.user, client.user, guildConfig, 0, reason)
              .catch((err) => {
                logger.error("guild member add: failed to create ban case", err);
              });
            break;
          }

          case AntiAltsActions.KICK: {
            caseData = await moderation
              .kickUser(guild, member, client.user, guildConfig, reason)
              .catch((err) => {
                logger.error("guild member add: faild to create kick case", err);
              });

            break;
          }

          case AntiAltsActions.MUTE: {
            caseData = await moderation
              .muteUser(guild, member, client.user, guildConfig, 0, reason)
              .catch((err) => {
                logger.error("guild member add: failed to create mute case", err);
              });
          }
        }
        if (caseData) {
          moderation.createCase(caseData);
        }
        return;
      }
    }
  }

  const selfMember = await client.getSelfMember(guild);
  if (
    guildConfig.welcome_message &&
    guildConfig.welcome_message.message &&
    guildConfig.welcome_message.channel_id
  ) {
    const parser = client.modules.get("Parser") as Parser | undefined;
    if (parser) {
      const tags = [
        [
          "user",
          {
            id: member.user.id,
            username: member.user.username,
            discriminator: member.user.discriminator,
            bot: member.user.bot,
            avatarURL: member.user.dynamicAvatarURL(undefined, 2048),
            tag: getTag(member.user),
            mention: member.user.mention,
          },
        ],
        [
          "server",
          {
            id: guild.id,
            name: guild.name,
            iconURL: guild.dynamicIconURL(undefined, 2048),
            ownerID: guild.ownerID,
            memberCount: guild.memberCount,
          },
        ],
      ];
      let string = guildConfig.welcome_message.message;
      let dm = false;
      if (string.includes("{dm}")) {
        dm = true;
        string = string.replace("{dm}", "");
      }

      const message = parser.parse(string, tags);
      if (message) {
        if (dm) {
          client
            .getDMChannel(member.user.id)
            .then((channel) => channel.createMessage(message))
            .catch((err) => logger.error("guild member add: failed to dm user", err));
        } else {
          const channel = guild.channels.get(guildConfig.welcome_message.channel_id);
          if (
            channel &&
            (channel.type === Constants.ChannelTypes.GUILD_TEXT ||
              channel.type === Constants.ChannelTypes.GUILD_NEWS) &&
            channel.permissionsOf(client.user.id).has("sendMessages")
          ) {
            channel
              .createMessage({
                content: message,
                allowedMentions: { users: true },
              })
              .catch((err) => logger.error("guild member add: failed to create message", err));
          }
        }
      }
    } else {
      logger.warn("guild member add: parser module not found");
    }
  }

  if (guildConfig.isPremium && guildConfig.automod && guildConfig.automod.modNames) {
    const autoMod = client.modules.get("AutoMod") as AutoMod | undefined;
    if (autoMod) {
      autoMod.moderateName(member, guild, guildConfig);
    }
  }

  if (
    !member.pending &&
    selfMember &&
    selfMember.permissions.has("manageRoles") &&
    guildConfig.autoroles
  ) {
    const autoroleData = [];
    const rolesToAdd = [];
    for (const autorole of guildConfig.autoroles) {
      switch (autorole.type) {
        case AutoRoleTypes.NORMAL: {
          const role = guild.roles.get(autorole.id);
          if (!role) {
            continue;
          }
          if (role.position >= highestRole(selfMember, guild).position) {
            continue;
          }
          rolesToAdd.push(autorole.id);
          break;
        }
        case AutoRoleTypes.TIMEOUT: {
          const role = guild.roles.get(autorole.id);
          if (!role) {
            continue;
          }
          if (role.position >= highestRole(selfMember, guild).position) {
            continue;
          }
          autoroleData.push({
            guildID: guild.id,
            userID: member.id,
            role: autorole.id,
            executeAt: new Date(Date.now() + (autorole.timeout || 1) * 60000),
          });
          break;
        }
      }
    }
    if (rolesToAdd.length > 0) {
      member.edit({ roles: [...member.roles, ...rolesToAdd] }).catch((err) => {
        logger.error(`guild member add: failed to edit member's role:`, err);
      });
    }
    if (autoroleData.length > 0) {
      collections.timeout_roles.insertMany(autoroleData).catch((err) => {
        logger.error(`guild member add: failed to insert autoroles:`, err);
      });
    }
  }
  if (guildConfig.moderation && guildConfig.moderation.muterole && selfMember) {
    const muterole = guild.roles.get(guildConfig.moderation.muterole);
    if (!muterole) return;

    if (
      muterole.position < highestRole(selfMember, guild).position &&
      selfMember.permissions.has("manageRoles")
    ) {
      collections.moderations
        .findOne({
          guildID: guild.id,
          userID: member.id,
          type: {
            $in: [ModerationTypes.MUTE, ModerationTypes.TEMPMUTE],
          },
        })
        .then((moderation) => {
          if (moderation) {
            member
              .addRole(muterole.id)
              .catch((err) =>
                logger.error("guild member add: failed to add mute role to member", err)
              );
          }
        })
        .catch((err) => {
          logger.error("guild member add: failed to fetch moderations", err);
        });
    }
  }
});
