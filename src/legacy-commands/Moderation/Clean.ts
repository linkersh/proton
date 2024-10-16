import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { Message, TextableChannel } from "eris";
import Logger from "../../core/structs/Logger";

class Clean extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "clean",
      description: "Clean a specific amount of messages.",
      usage: "<count>",
      category: "moderation",
      cooldown: 3500,
      allowMods: true,
      aliases: [],
      clientPerms: ["sendMessages"],
      userPerms: ["manageMessages"],
    });
  }
  execute({ message, args, config }: ExecuteArgs) {
    const filter = (msg: Message<TextableChannel>) => {
      if (msg.id === message.id) {
        return true;
      }
      if (msg.author.id === this.client.user.id) {
        return true;
      }
      const prefix = config.prefixes && config.prefixes.find((p) => msg.content.startsWith(p));
      if (!prefix) {
        return false;
      }
      const cmd = msg.content.slice(prefix.length).trimStart().split(" ").shift();
      if (cmd && (this.client.legacyCommands.has(cmd) || this.client.aliases.has(cmd))) {
        return true;
      }
      return false;
    };
    let amount = parseInt(args[0]);
    if (amount > 100) {
      amount = 100;
    }
    if (amount < 5) {
      amount = 5;
    }
    message.channel
      .purge({ filter: filter, limit: amount })
      .catch((err) => Logger.warn(`command: clean: failed to purge messages`, err));
  }
}
export default Clean;
