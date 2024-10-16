import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import { EmbedBuilder } from "../../utils/EmbedBuilder.js";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { Constants } from "eris";

class ServerInfo extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "serverinfo",
      description: "View basic information about this server.",
      usage: "",
      aliases: ["si"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  execute({ message }: ExecuteArgs) {
    const { guild } = message.channel;
    const textChannels = guild.channels.filter(
      (x) => x.type === Constants.ChannelTypes.GUILD_TEXT
    ).length;
    const voiceChannels = guild.channels.filter(
      (x) => x.type === Constants.ChannelTypes.GUILD_VOICE
    ).length;
    const roles = `${guild.roles
      .filter((x) => x.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map((x) => x.mention)
      .join(" ")}`;
    const memberList = [...guild.members.values()];
    let bots = 0;
    let members = 0;
    for (const member of memberList) {
      if (member.user.bot) {
        bots++;
      } else {
        members++;
      }
    }
    const botsFormat = bots.toLocaleString();
    const membersFormat = members.toLocaleString();
    const infoEmbed = new EmbedBuilder()
      .title(guild.name)
      .field("Created At", `<t:${Math.floor(guild.createdAt / 1000)}:F>`, true)
      .field("ID", guild.id, true)
      .field("Owner", `<@!${guild.ownerID}>`, true)
      .field(
        `Members (${guild.memberCount.toLocaleString()})`,
        `Humans: **${membersFormat}**, Bots: **${botsFormat}**`,
        true
      )
      .field("Channels", `Text: **${textChannels}**, Voice: **${voiceChannels}**`, true)
      .field(
        `Roles (${guild.roles.size})`,
        `${roles.length <= 1024 ? roles : "Too much to display!"}`,
        false
      )
      .color("theme")
      .thumbnail(guild.dynamicIconURL(undefined, 512) ?? "");
    return message.channel.createMessage({
      messageReference: { messageID: message.id, failIfNotExists: false },
      embeds: [infoEmbed.build()],
    });
  }
}
export default ServerInfo;
