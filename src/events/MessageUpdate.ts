import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import GuildLogger from "../modules/ServerLogger";

export default new ClientEvent("messageUpdate", (client, message) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.message.messageUpdate(message);
  } else {
    logger.warn("message update: couldn't find the guild logger module");
  }
});
