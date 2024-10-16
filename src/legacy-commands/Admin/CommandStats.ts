import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder";

class CommandStats extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "command_stats",
      description: "n/a",
      usage: "<days>",
      category: "admin",
      aliases: [],
      clientPerms: [],
      userPerms: [],
      commands: [
        {
          name: "day",
          desc: "Find usage on a specific day.",
          usage: "<integer>",
        },
      ],
      cooldown: 0,
      admin: true,
    });
  }
  async execute({ message }: ExecuteArgs) {
    const data = await collections.command_stats
      .aggregate([
        { $addFields: { commands: { $objectToArray: "$commands" } } },
        { $unwind: "$commands" },
        {
          $group: {
            _id: "$commands.k",
            sum: { $sum: "$commands.v" },
          },
        },
        {
          $group: {
            _id: null,
            commands: {
              $mergeObjects: {
                $arrayToObject: [[{ k: "$_id", v: "$sum" }]],
              },
            },
            total: {
              $sum: "$sum",
            },
          },
        },
      ])
      .toArray();
    if (!data?.length) {
      return this.errorMessage(message, "No statistics found.");
    }

    const doc = data[0];
    const top = Object.keys(doc.commands).sort((a, b) => {
      return doc.commands[b] - doc.commands[a];
    });
    const builder = new EmbedBuilder()
      .title("Total:" + doc.total.toString())
      .color("theme")
      .field("Top 5 commands:", top.slice(0, 5).join(", "));
    await this.client.createMessage(message.channel.id, {
      embeds: [builder.build()],
    });
  }
  async day({ message, args }: ExecuteArgs) {
    const days = parseInt(args[0]);
    const date = new Date(Date.now() + (days - 1) * 8.64e7);
    const data = await collections.command_stats.findOne({
      timestamp: { $gte: date },
    });
    if (!data) {
      return this.errorMessage(message, `No data`);
    }

    let description = "";
    for (const [key, value] of Object.entries(data.commands)) {
      description += `${key}: ${value.toLocaleString()}\n`;
    }
    await this.client.createMessage(message.channel.id, {
      embeds: [{ description }],
    });
  }
}
export default CommandStats;
