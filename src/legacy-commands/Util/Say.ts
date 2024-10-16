import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger.js";
class Say extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "say",
      description: "Make the bot say something",
      usage: "<text>",
      aliases: ["echo"],
      category: "util",
      cooldown: 3000,
      userPerms: ["manageMessages"],
      clientPerms: ["sendMessages"],
    });
  }
  execute({ message, args }: ExecuteArgs) {
    let text = args.join(" ");
    if (!text) {
      return this.errorMessage(message, "Specify some text...");
    }
    const channel = this.parseChannel(args[0], message.channel.guild) || message.channel;
    if (channel.id !== message.channel.id) {
      text = args.slice(1).join(" ");
    }
    if (!channel.permissionsOf(message.member).has("sendMessages")) {
      return this.errorMessage(message, "You cannot send messages in that channel.");
    }
    channel
      .createMessage({ content: text.slice(0, 2000) })
      .catch((err) => Logger.warn(`command: say: failed to create message`, err));
  }
}
export default Say;
