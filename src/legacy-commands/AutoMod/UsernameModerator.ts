import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
class UsernameModerator extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "username-mod",
      description: "Moderate nicknames & usernames of users.",
      usage: "<enable|disable>",
      aliases: ["umod", "usernamemod", "nickmod"],
      category: "automod",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
      premiumOnly: true,
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const option = args[0]?.toLowerCase() || null;
    if (option === "enable") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.modNames": true } }
      );
      this.successMessage(message, `I will now moderate usernames & nicknames.`);
    } else if (option === "disable") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $unset: { "automod.modNames": "" } }
      );
      this.successMessage(message, `I will not moderate usernames & nicknames.`);
    } else {
      this.errorMessage(message, `Please use a valid option, \`enable\` or \`disable\``);
    }
  }
}
export default UsernameModerator;
