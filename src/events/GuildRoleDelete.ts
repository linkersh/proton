import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import GuildLogger from "../modules/ServerLogger";

export default new ClientEvent("guildRoleDelete", (client, guild, role) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.role.guildRoleDelete(guild, role);
  } else {
    logger.warn("guild role delete: couldn't find the guild logger module");
  }
});
