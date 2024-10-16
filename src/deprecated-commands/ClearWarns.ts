import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
import { PunishmentTypes } from "../../Constants";
import { getTag } from "../../utils/Util";

class ClearWarns extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "clearwarns",
      description: "Clear all user's warnings.",
      usage: "<user>",
      category: "moderation",
      cooldown: 2500,
      aliases: ["clear-warns", "remove-warns"],
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const user = (await this.resolveUser(args.join(" "))) || message.author;
    if (!user) {
      return this.errorMessage(message, "Specify a valid member to clear warnings of.");
    }
    await collections.cases
      .deleteMany({
        guild_id: message.guildID,
        "user.id": user.id,
        type: PunishmentTypes.WARN,
      })
      .then((deleted) => {
        this.successMessage(
          message,
          `Deleted **${deleted.deletedCount}** warninigs of ${getTag(user)}.`
        );
      });
  }
}
export default ClearWarns;
