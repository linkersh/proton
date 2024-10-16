import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
class PurgeLimit extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "purgelimit",
      usage: "<limit>",
      description: "A limit to how many messages can be purged at once.",
      category: "config",
      cooldown: 3000,
      aliases: [],
      userPerms: ["administrator"],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message, args, prefix }: ExecuteArgs) {
    const limit = parseInt(args[0]);
    if (limit > 500) {
      return this.errorMessage(message, `Purge limit cannot be above 500.`);
    }
    if (limit < 2) {
      return this.errorMessage(
        message,
        `Purge limit cannot be below 2, if you want to disable the command use` +
          `\n\`${prefix}commandcfg disable purge\``
      );
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "moderation.purgeLimit": limit } }
    );
    this.successMessage(message, `Purge limit set to \`${limit}\`.`);
  }
}
export default PurgeLimit;
