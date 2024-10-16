import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import GuildLogger from "../modules/ServerLogger";

export default new ClientEvent("guildUpdate", (client, guild, oldGuild) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.server.guildUpdate(guild, oldGuild);
  } else {
    logger.warn("guild update: couldn't find the guild logger module");
  }
});
