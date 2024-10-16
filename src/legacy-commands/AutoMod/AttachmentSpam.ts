import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";

class AttachmentSpam extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "attachmentspam",
      description:
        "Prevent members from sending too many attachments (images, gifs, videos, etc...).",
      usage: "<attachment count/per second>",
      aliases: ["attachments", "attachment-spam"],
      commands: [
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
      premiumOnly: true,
    });
  }
  execute({ message, args }: ExecuteArgs) {
    const split = args[0]?.split("/");
    if (!split || split.length < 2) {
      return this.errorMessage(
        message,
        "Specify a valid threshold like: `<attachment count/per second>`."
      );
    }
    const maxAttachments = parseInt(split[0]);
    const seconds = parseInt(split[1]);
    if (isNaN(maxAttachments) || isNaN(seconds)) {
      return this.errorMessage(
        message,
        "Max attachments and seconds must be a number and above 0."
      );
    }
    if (maxAttachments < 2 || seconds < 1) {
      return this.errorMessage(
        message,
        "Max attachments needs to be above 1 and seconds must be above 0."
      );
    }
    const attachments = {
      max_attachments: maxAttachments,
      seconds: seconds,
      actions: 0,
      duration: 0,
    };

    createActionButtons(message, async ({ duration, actions, interaction }) => {
      attachments["actions"] = actions;
      if (duration > 0) {
        attachments["duration"] = duration * 60000;
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.attachments": attachments } }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated attachment spam automod module.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.attachments": "" } }
    );
    this.successMessage(message, "Disabled the attachment-spam automod.");
  }
}
export default AttachmentSpam;
