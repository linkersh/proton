import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";

const snowflakeRegex = /^[0-9]{16,19}$/;

class Invites extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "invites",
      description:
        "Prevent members from sending server invites and advertising using this automod module.",
      usage: "",
      aliases: ["invites"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
      commands: [
        {
          name: "add",
          desc: "Ignore all invites of a specific server(s)",
          usage: "<server id>",
          cooldown: 3000,
        },
        {
          name: "remove",
          desc: "Remove a specific server from the invite link whitelist.",
          usage: "<server id>",
          cooldown: 3000,
        },
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
    });
  }
  async execute({ message }: ExecuteArgs) {
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      const invites = {
        actions: actions,
        duration: 0,
      };
      if (duration) {
        invites["duration"] = duration * 60000;
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.invites": invites } }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated anti-invites module.`,
        components: [],
      });
    });
  }
  async add({ message, args }: ExecuteArgs) {
    if (!snowflakeRegex.test(args[0])) {
      return this.errorMessage(
        message,
        "That is not a valid server ID, if you need help getting a server ID join our support server."
      );
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $addToSet: { "automod.allowedInvites": args[0] } }
    );
    this.successMessage(message, `Invite links from server \`${args[0]}\` will now be ignored.`);
  }
  async remove({ message, args }: ExecuteArgs) {
    if (!snowflakeRegex.test(args[0])) {
      return this.errorMessage(
        message,
        "That is not a valid server ID, if you need help getting a server ID join our support server."
      );
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { "automod.allowedInvites": args[0] } }
    );
    this.successMessage(
      message,
      `Invite links from server \`${args[0]}\` will no longer be ignored.`
    );
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.invites": "", "automod.allowedInvites": "" } }
    );
    this.successMessage(message, "Disabled the invites automod.");
  }
}
export default Invites;
