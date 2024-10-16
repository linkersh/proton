import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger";
import { collections } from "../../core/database/DBClient";

const snowflakeRegex = /^[0-9]{16,19}$/;

class BanGuild extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "ban-guild",
      description: "???",
      usage: "???",
      category: "admin",
      cooldown: 0,
      aliases: [],
      clientPerms: [],
      userPerms: [],
      admin: true,
    });
  }

  async execute({ message, args }: ExecuteArgs) {
    if (message.author.id !== "521677874055479296") {
      return;
    }

    const guildID = args[0];
    if (!guildID || !snowflakeRegex.test(guildID)) {
      return this.errorMessage(message, "Guild id doesn't match ^[0-9]{16,19}$");
    }

    const rawUnbanDate = args[1];
    if (!rawUnbanDate) {
      return this.errorMessage(message, `Specify the unban date.`);
    }

    const unbanDate = Date.parse(rawUnbanDate);
    if (unbanDate < Date.now() || isNaN(unbanDate)) {
      return this.errorMessage(message, "Ban date must be in the future.");
    }

    const reason = args[2];
    if (!reason) {
      return this.errorMessage(message, `Specify the reason for the ban.`);
    }

    try {
      await collections.guildconfigs.updateOne(
        { _id: guildID },
        {
          $set: {
            prefixes: ["-"],
            unban_date: new Date(unbanDate),
            ban_reason: reason,
          },
        },
        { upsert: true }
      );
    } catch (err) {
      Logger.error(`command:ban-guild`, err);
      return this.errorMessage(message, "Failed to ban guild");
    }
    return this.successMessage(message, `Guild \`${guildID}\` has been banned.`);
  }
}

export default BanGuild;
