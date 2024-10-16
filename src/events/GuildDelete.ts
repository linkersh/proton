import { Constants } from "eris";
import { collections } from "../core/database/DBClient";
import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";

export default new ClientEvent("guildDelete", async (client, guild) => {
  if (!("name" in guild)) return;
  logger.info(`Left guild: ${guild.id}`);
  collections.quarantined_guilds
    .insertOne({
      _id: guild.id,
      checked: true,
      createdAt: new Date(),
    })
    .catch((err) => logger.error("guild delete: failed to quarantine guild", err));

  const logGuild = await client.getGuild("898104546000261130");
  if (logGuild) {
    const guildLogCh = logGuild.channels.get("898104691018317836");
    if (guildLogCh && guildLogCh.type === Constants.ChannelTypes.GUILD_TEXT) {
      guildLogCh
        .createMessage(`Left **${guild.name}** (\`${guild.id}\`), members: ${guild.memberCount}`)
        .catch((err) => logger.error("guild delete: failed to create message", err));
    }
  }
});
