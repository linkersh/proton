import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class DmMessage extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "dms",
      description:
        "Toggle whether to send direct messages when a user is banned/kicked/muted/warned.",
      usage: "",
      cooldown: 4000,
      category: "config",
      commands: [
        {
          name: "bans",
          desc: "Toggle whether to send dms to the target when a user is banned.",
          cooldown: 3500,
          usage: "<true|false>",
        },
        {
          name: "kicks",
          desc: "Toggle whether to send dms to the target when a user is kicked.",
          cooldown: 3500,
          usage: "<true|false>",
        },
        {
          name: "mutes",
          desc: "Toggle whether to send dms to the target when a user is muted/unmuted.",
          cooldown: 3500,
          usage: "<true|false>",
        },
        {
          name: "warns",
          desc: "Toggle whether to send dms to the target when a user is warned.",
          cooldown: 3500,
          usage: "<true|false>",
        },
        {
          name: "message",
          desc: "Customize custom dm message for ban, kick, mute and warn commands.",
          cooldown: 3000,
          usage: "<command_name> <dm_message>",
        },
      ],
      aliases: [],
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
      premiumOnly: true,
    });
  }
  async bans({ message, args }: ExecuteArgs) {
    const bool = (args[0] || "false").toLowerCase() === "true" ? true : false;
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "moderation.dmBans": bool } }
    );
    if (bool) {
      this.successMessage(message, "I will now send DMs to banned users.");
    } else {
      this.successMessage(message, "I will no longer send DMs to banned users.");
    }
  }
  async kicks({ message, args }: ExecuteArgs) {
    const bool = (args[0] || "false").toLowerCase() === "true" ? true : false;
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "moderation.dmKicks": bool } }
    );
    if (bool) {
      this.successMessage(message, "I will now send DMs to kicked users.");
    } else {
      this.successMessage(message, "I will no longer send DMs to kicked users.");
    }
  }
  async mutes({ message, args }: ExecuteArgs) {
    const bool = (args[0] || "false").toLowerCase() === "true" ? true : false;
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "moderation.dmMutes": bool } }
    );
    if (bool) {
      this.successMessage(message, "I will now send DMs to muted/unmuted users.");
    } else {
      this.successMessage(message, "I will no longer send DMs to muted/unmuted users.");
    }
  }
  async warns({ message, args }: ExecuteArgs) {
    const bool = (args[0] || "false").toLowerCase() === "true" ? true : false;
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "moderation.dmWarns": bool } }
    );
    if (bool) {
      this.successMessage(message, "I will now send DMs to warned users.");
    } else {
      this.successMessage(message, "I will no longer send DMs to warned users.");
    }
  }
  async message({ message, args }: ExecuteArgs) {
    const commands = ["ban", "kick", "mute", "warn"];
    const cmdName = commands.find((x) => x === args[0]?.toLowerCase());
    if (!cmdName) {
      return this.errorMessage(
        message,
        `Specify a valid command from: ${commands.join(", ")} to customize direct message of.`
      );
    }
    const msgString = args.slice(1).join(" ");
    if (!msgString) {
      return this.errorMessage(message, `Specify a message to send.`);
    }
    await collections.command_configs.updateOne(
      { _id: message.guildID },
      { $set: { [`commands.${cmdName}.dmMessage`]: msgString } },
      { upsert: true }
    );
    this.successMessage(message, `Updated custom dm message for command: ${cmdName}.`);
  }
}
export default DmMessage;
