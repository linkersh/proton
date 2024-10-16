import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import GuildLogger from "../modules/ServerLogger";

export default new ClientEvent("messageDeleteBulk", (client, messages) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.message.messageDeleteBulk(messages);
  } else {
    logger.warn("message delete bulk: couldn't find the guild logger module");
  }
});
