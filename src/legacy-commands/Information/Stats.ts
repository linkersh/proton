import prettyMilliseconds from "pretty-ms";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder.js";
import { db } from "../../core/database/DBClient";
import Moderation from "../../modules/Moderation";
import logger from "../../core/structs/Logger";

class Stats extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "stats",
      description: "View basic statistics about the bot.",
      usage: "",
      cooldown: 3000,
      aliases: ["botinfo", "statistics"],
      category: "info",
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  /**
   *
   * @param {object} data
   * @param {import('eris').Message} data.message
   */
  async execute({ message }: ExecuteArgs) {
    const stats = await db.stats({ scale: 1024 });
    const dataSizeMB = stats.dataSize / 1024;
    const Moderation = this.client.modules.get("Moderation") as Moderation | undefined;

    let ownerTag = "Unknown User";
    let user = null;
    if (Moderation) {
      user = await Moderation.getUser("521677874055479296");
    } else {
      logger.warn("stats: moderation module not loaded");
    }

    if (user && user.username && user.discriminator) {
      ownerTag = `${user.username}#${user.discriminator}`;
    }
    let members = 0;
    const guilds = [...this.client.guilds.values()];
    for (let i = 0; i < guilds.length; i++) {
      members += guilds[i].memberCount;
    }
    const builder = new EmbedBuilder()
      .title("Proton's Stats")
      .description(
        `[Community Server](https://proton-bot.net/support)\nOwner/Developer: \`${ownerTag}\``
      )
      .field("Servers", this.client.guilds.size.toLocaleString(), true)
      .field("Users", this.client.users.size.toLocaleString(), true)
      .field("Uptime", prettyMilliseconds(process.uptime() * 1000), true)
      .field("Database Size", `${dataSizeMB.toLocaleString()} MB`, true)
      .field("Shards", `${this.client.shards.size}`, true)
      .field("Server Members", `${members.toLocaleString()}`, true)
      .color("theme");
    return message.channel.createMessage({ embeds: [builder.build()] });
  }
}
export default Stats;
