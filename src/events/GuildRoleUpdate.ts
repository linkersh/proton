import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import GuildLogger from "../modules/ServerLogger";

export default new ClientEvent("guildRoleUpdate", (client, guild, role, oldRole) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.role.guildRoleUpdate(guild, role, oldRole);
  } else {
    logger.warn("guild role update: couldn't find the guild logger module");
  }
});
