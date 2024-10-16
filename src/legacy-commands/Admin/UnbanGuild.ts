import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import { collections } from "../../core/database/DBClient";

const snowflakeRegex = /^[0-9]{16,19}$/;

class UnbanGuild extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "unban-guild",
      description: "???",
      usage: "???",
      category: "admin",
      cooldown: 0,
      admin: true,
      aliases: [],
      clientPerms: [],
      userPerms: [],
    });
  }
  /**
   *
   * @param {object} param0
   * @param {import('eris').Message} param0.message
   * @param {string[]} param0.args
   * @param {string} param0.prefix
   */
  async execute({ message, args }: ExecuteArgs) {
    if (message.author.id !== "521677874055479296") {
      return;
    }

    const guildID = args[0];
    if (!guildID || !snowflakeRegex.test(guildID)) {
      return this.errorMessage(message, "Guild id doesn't match ^[0-9]{16,19}$");
    }

    try {
      await collections.guildconfigs.updateOne(
        { _id: guildID },
        { $unset: { unban_date: "", ban_reason: "" } }
      );
    } catch (err) {
      Logger.error(`command:ban-guild`, err);
      return this.errorMessage(message, "Failed to un-ban guild");
    }
    return this.successMessage(message, `Guild \`${guildID}\` has been un-banned.`);
  }
}

export default UnbanGuild;
