import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";
import { CustomEmojis } from "../../Constants";

class MessageSpam extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "messagespam",
      description: "Configure message spam automod.",
      usage: "<max messages/seconds>",
      commands: [
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: [],
      category: "automod",
      cooldown: 3000,
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const split = args[0]?.split("/");
    if (!split || split.length < 2) {
      return this.errorMessage(
        message,
        "Specify a valid threshold like: `<message count/per seconds>`."
      );
    }
    const maxMessages = parseInt(split[0]);
    const seconds = parseInt(split[1]);
    if (isNaN(maxMessages) || isNaN(seconds)) {
      return this.errorMessage(message, "Max messages and seconds need to be a number.");
    }
    if (maxMessages < 1 || seconds < 1) {
      return this.errorMessage(message, "Max messages and seconds need to be above 1.");
    }
    const messageSpam = {
      max_messages: maxMessages,
      seconds: seconds,
      actions: 0,
      duration: 0,
    };

    createActionButtons(message, async ({ duration, actions, interaction }) => {
      messageSpam.actions = actions;
      messageSpam.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.spam": messageSpam,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated the message spam automod.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.spam": "" } }
    );
    this.successMessage(message, "Disabled the message-spam automod.");
  }
}
export default MessageSpam;
