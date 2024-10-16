import { AutoRoleTypes } from "../Constants";
import { collections } from "../core/database/DBClient";
import { highestRole } from "../utils/Util";
import AutoMod from "../modules/AutoMod/";
import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import GuildLogger from "../modules/ServerLogger";

export default new ClientEvent("guildMemberUpdate", async (client, guild, member, oldMember) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.member.guildMemberUpdate(guild, member, oldMember);
  } else {
    logger.warn("guild member update: couldn't find the guild logger module");
  }

  const guildConfig = await client.getGuildConfig(guild.id);
  if (!guildConfig) return;

  const selfMember = await client.getSelfMember(guild);
  if (
    oldMember &&
    oldMember.pending &&
    !member.pending &&
    selfMember &&
    guildConfig.autoroles &&
    selfMember.permissions.has("manageRoles")
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
        logger.error(`guild member update: failed to edit member's role:`, err);
      });
    }
    if (autoroleData.length > 0) {
      collections.timeout_roles.insertMany(autoroleData).catch((err) => {
        logger.error(`guild member update: failed to insert autoroles:`, err);
      });
    }
  }

  if (guildConfig.automod && guildConfig.automod.modNames && member.joinedAt !== null) {
    if (Date.now() - member.joinedAt <= 5000) return;
    if (!oldMember || oldMember.nick === member.nick) return;
    const autoMod = client.modules.get("AutoMod") as AutoMod | undefined;
    if (!autoMod) return;

    autoMod.moderateName(member, guild, guildConfig);
  }
});
