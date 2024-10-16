import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class EventStats extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "eventstats",
      description: "See the event statistics.",
      usage: "",
      aliases: ["event-stats"],
      category: "admin",
      cooldown: 0,
      clientPerms: [],
      userPerms: [],
      admin: true,
    });
  }
  /**
   *
   * @param {object} data
   * @param {import('eris').Message} data.message
   * @param {string[]} data.args
   */
  async execute({ message }: ExecuteArgs) {
    const event_stats = await collections.event_stats
      .aggregate([
        { $addFields: { events: { $objectToArray: "$events" } } },
        { $unwind: "$events" },
        {
          $group: {
            _id: "$events.k",
            sum: { $sum: "$events.v" },
          },
        },
      ])
      .toArray();
    let total = 0;
    let table = "";
    for (const item of event_stats) {
      total += item.sum;
      table += `${item._id}: ${item.sum?.toLocaleString() || "0"}\n`;
    }
    this.client
      .createMessage(
        message.channel.id,
        `\`\`\`Total: ${total?.toLocaleString() || "0"}\n${table}\`\`\``
      )
      .catch(() => 0);
  }
}
export default EventStats;
