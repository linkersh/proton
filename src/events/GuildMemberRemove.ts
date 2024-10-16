import { Constants } from "eris";
import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import Parser from "../modules/Parser";
import GuildLogger from "../modules/ServerLogger";
import { getTag } from "../utils/Util";

export default new ClientEvent("guildMemberRemove", async (client, guild, member) => {
  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.gateway.guildMemberRemove(guild, member);
  } else {
    logger.warn("guild member remove: couldn't find the guild logger module");
  }

  const guildConfig = await client.getGuildConfig(guild.id);
  if (!guildConfig) return;

  if (
    guildConfig.leave_message &&
    guildConfig.leave_message.message &&
    guildConfig.leave_message.channel_id
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
      const message = parser.parse(guildConfig.leave_message.message, tags);
      if (message) {
        const channel = guild.channels.get(guildConfig.leave_message.channel_id);
        if (
          channel &&
          (channel.type === Constants.ChannelTypes.GUILD_TEXT ||
            channel.type === Constants.ChannelTypes.GUILD_NEWS) &&
          channel.permissionsOf(client.user.id).has("sendMessages")
        ) {
          channel
            .createMessage(message)
            .catch((err) =>
              logger.error("guild member remove: failed to create leave message", err)
            );
        }
      }
    } else {
      logger.warn("guild member remove: parser module not found");
    }
  }
});
