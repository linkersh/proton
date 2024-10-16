import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class MessageQuote extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "message-preview",
      description:
        "Whether to delete message links and show a brief preview of a message linked (if valid).",
      usage: "<true|false>",
      cooldown: 5000,
      aliases: [],
      category: "config",
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const lower = (args[0] || "false").toLowerCase();
    if (lower === "true") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { messagePreview: true } }
      );
      this.successMessage(
        message,
        "I will now send a preview of messages when a message link is posted in the chat."
      );
    } else {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { messagePreview: false } }
      );
      this.errorMessage(message, "I will no longer send preview of messages.");
    }
  }
}
export default MessageQuote;
