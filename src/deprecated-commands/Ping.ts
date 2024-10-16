import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class Ping extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "ping",
      description: "Ping pong",
      usage: "",
      aliases: ["pong"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message }: ExecuteArgs) {
    const start = Date.now();
    await collections.levels.find().limit(1).count();
    const end = Date.now();
    const shardPing = message.channel.guild.shard.latency;
    return message.channel.createMessage({
      content: `**Shard:** ${shardPing}ms` + `\n**Database:** ${end - start}ms`,
      messageReference: { messageID: message.id, failIfNotExists: false },
    });
  }
}
export default Ping;
