import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import { Constants } from "eris";
class Slowmode extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "slowmode",
      description: "Set slowmode in a channel.",
      usage: "<interval in seconds> [channel(s)]",
      aliases: [],
      category: "moderation",
      allowMods: true,
      cooldown: 4000,
      clientPerms: ["sendMessages", "manageChannels", "readMessageHistory"],
      userPerms: ["manageChannels"],
    });
  }
  /**
   *
   * @param {object} data
   * @param {import('eris').Message} data.message
   * @param {string[]} args
   */
  async execute({ message, args }: ExecuteArgs) {
    const seconds = Number(args[0]) || 0;
    let channels = this.parseChannels(args.slice(1).join(" "), message.channel.guild);
    if (channels.length === 0) {
      channels = [message.channel.id];
    }
    if (channels.length > 5) {
      channels = channels.slice(0, 5);
    }
    for (const channelID of channels) {
      const channel = message.channel.guild.channels.get(channelID);
      if (!channel) {
        return;
      }
      if (
        channel.type !== Constants.ChannelTypes.GUILD_NEWS &&
        channel.type !== Constants.ChannelTypes.GUILD_TEXT
      ) {
        return this.errorMessage(message, `${channel.mention} is not a text or a thread channel.`);
      }
      if (seconds > 21600) {
        return this.errorMessage(message, `Interval cannot be above 21600`);
      }
      if (seconds < 0) {
        return this.errorMessage(message, `Interval cannot be below 0.`);
      }
      if (channel.rateLimitPerUser === seconds) {
        return this.errorMessage(
          message,
          `The slowmode in channel: ${
            channel.mention
          } is already **${seconds.toLocaleString()}** seconds`
        );
      }
      if (!channel.permissionsOf(this.client.user.id).has("manageChannels")) {
        return this.errorMessage(message, `I cannot edit slowmode in that ${channel.mention}.`);
      }
      try {
        await channel.edit({ rateLimitPerUser: seconds });
      } catch (err) {
        Logger.error(`command: slowmode: failed to edit channel ratelimit`, err);
        return this.errorMessage(message, `Couldn't modify slowmode in that channel.`);
      }
    }
    this.successMessage(
      message,
      `Set the slowmode in ${channels
        .map((c) => `<#${c}>`)
        .join(", ")} to **${seconds.toLocaleString()}** seconds.`
    );
  }
}
export default Slowmode;
