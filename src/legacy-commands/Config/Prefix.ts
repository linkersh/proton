import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class Prefix extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "prefix",
      usage: "<command>",
      description: "Add and remove prefixes in this server.",
      commands: [
        {
          name: "add",
          desc: "Add a new prefix",
          cooldown: 3000,
          usage: "<prefix>",
        },
        {
          name: "remove",
          desc: "Remove an existing prefix.",
          cooldown: 300,
          usage: "<existing_prefix>",
        },
        {
          name: "list",
          desc: "View prefixes in this guild.",
        },
      ],
      aliases: [],
      category: "config",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async add({ message, args, config }: ExecuteArgs) {
    const prefix = args.join(" ");
    if (prefix.length > 256) {
      return this.errorMessage(message, "Prefix length can't be above 256 characters.");
    }
    if (config.prefixes && config.prefixes.length >= 10) {
      return this.errorMessage(message, "You can't add more than 10 prefixes.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $addToSet: { prefixes: prefix } }
    );
    this.successMessage(message, `Added a prefix: \`${prefix}\``);
  }
  async remove({ message, args }: ExecuteArgs) {
    const prefix = args.join(" ");
    if (!prefix) {
      return this.errorMessage(message, "You need to specify a valid prefix to remove.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { prefixes: prefix } }
    );
    this.successMessage(message, `Removed a prefix: \`${prefix}\``);
  }
  list({ message, config }: ExecuteArgs) {
    return message.channel.createMessage(`${(config.prefixes ?? []).join(", ")}`);
  }
}
export default Prefix;
