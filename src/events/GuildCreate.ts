import { Constants, GuildTextableChannel } from "eris";
import { collections } from "../core/database/DBClient";
import ClientEvent from "../core/structs/ClientEvent";
import logger from "../core/structs/Logger";
import Help from "../legacy-commands/Information/Help";

export default new ClientEvent("guildCreate", async (client, guild) => {
  logger.info(`Joined guild: ${guild.id} (${guild.name}), members: ${guild.memberCount}`);
  const logGuild = await client.getGuild("898104546000261130");
  if (logGuild) {
    const guildLogCh = logGuild.channels.get("898104691018317836");
    if (guildLogCh && guildLogCh.type === Constants.ChannelTypes.GUILD_TEXT) {
      guildLogCh
        .createMessage(`Joined **${guild.name}** (\`${guild.id}\`), members: ${guild.memberCount}`)
        .catch((err) => logger.error("guild create: failed to create message", err));
    }
  }

  const guildConfig = await client.getGuildConfig(guild.id);
  if (guildConfig && guildConfig.unban_date && guildConfig.unban_date.getTime() > Date.now()) {
    logger.info(`Leaving banned guild: ${guildConfig._id}`);
    guild.leave().catch((err) => logger.error("guild create: failed to leave guild", err));
    return;
  }

  collections.quarantined_guilds
    .deleteOne({ _id: guild.id })
    .catch((err) => logger.error("guild create: failed to delete quarantined guild", err));

  const selfMember = await client.getSelfMember(guild);
  if (!selfMember) return;

  let inviter;
  if (guild.permissionsOf(selfMember).has("viewAuditLog")) {
    let data;
    try {
      data = await guild.getAuditLog({
        actionType: Constants.AuditLogActions.BOT_ADD,
        limit: 1,
      });
    } catch (err) {
      logger.error("guild create: failed to fetch audit log", err);
    }
    if (data && data.entries[0]) {
      if (
        data.entries[0].targetID === client.user.id &&
        Date.now() - data.entries[0].createdAt < 10_000
      ) {
        inviter = data.entries[0].user;
      }
    }
  }

  const randomChannel = guild.channels.find((x) => {
    const perms = x.permissionsOf(selfMember);
    return (
      x.type === Constants.ChannelTypes.GUILD_TEXT &&
      perms.has("sendMessages") &&
      perms.has("viewChannel")
    );
  }) as GuildTextableChannel | undefined;
  if (!randomChannel) {
    return;
  }

  let message: string;
  if (inviter) {
    message = `Thanks for inviting me to your server ${inviter.mention}!\n**Docs:** https://docs.proton-bot.net\n**Support:** <https://proton-bot.net/support>`;
  } else {
    message =
      "Thanks for inviting me to your server!\n**Docs:** https://docs.proton-bot.net\n**Support:** <https://proton-bot.net/support>";
  }
  randomChannel
    .createMessage({ content: message, allowedMentions: { users: true } })
    .catch((err) => logger.error("guild create: failed to create message in random channel", err));
  const helpCommand = client.legacyCommands.get("help") as Help | undefined;
  if (helpCommand) {
    helpCommand.buildDefaultEmbed(randomChannel, []);
  }
});
