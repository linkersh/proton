import { PunishmentTypes } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class ClearWarns extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "delete-warn",
      description: "Delete a user's warning",
      usage: "<id>",
      category: "moderation",
      cooldown: 2500,
      aliases: ["deletewarn", "clearwarn", "clear-warn", "delete-warning"],
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const case_id = Number(args[0]);
    if (!Number.isSafeInteger(case_id)) {
      return this.errorMessage(message, "That's not a valid integer.");
    }

    await collections.cases
      .deleteOne({
        guild_id: message.guildID,
        id: case_id,
        type: PunishmentTypes.WARN,
      })
      .then((res) => {
        if (res.deletedCount === 0) {
          this.successMessage(message, `Either this case doesn't exist or it's not a warning.`);
        } else {
          this.successMessage(message, `Deleted warning case **#${case_id}**.`);
        }
      });
  }
}
export default ClearWarns;
