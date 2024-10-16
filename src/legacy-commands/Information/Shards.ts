import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
class Shards extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "shards",
      description: "View the Proton's shards.",
      usage: "",
      aliases: [],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    let page = Number(args[0]) || 1;
    if (page < 1) {
      page = 1;
    }
    const embed = new EmbedBuilder().title(`Shards - Page #${page}`).color("theme");
    const shards = [...this.client.shards.values()].slice(page > 1 ? (page - 1) * 9 : 0, page * 9);
    for (let x = 0; x < shards.length; x++) {
      const shard = shards[x];
      const servers = this.client.guilds.filter((x) => x.shard.id === shard.id);
      const usrCnt = servers.reduce((total, obj) => obj.memberCount + total, 0).toLocaleString();
      embed.field(
        `Shard #${shard.id + 1}`,
        `**Server count:** ${servers.length}\n**Latency:** ${shard.latency}ms\n**Status:** ${shard.status}\n**Users:** ${usrCnt}`,
        true
      );
    }
    if (embed._fields.length === 0) {
      return this.errorMessage(message, `There are no shards on that page.`);
    }
    return message.channel.createMessage({ embeds: [embed.build()] });
  }
}
export default Shards;
