import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";

class MentionSpam extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "mentionspam",
      description: "Configure mention spam automod.",
      usage: "<max mentions/seconds>",
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
        "Specify a valid threshold like: `<mention count/per seconds>`."
      );
    }
    const maxMentions = parseInt(split[0]);
    const seconds = parseInt(split[1]);
    if (isNaN(maxMentions) || isNaN(seconds)) {
      return this.errorMessage(message, "Max mentions and seconds need to be a number.");
    }
    if (maxMentions < 1 || seconds < 1) {
      return this.errorMessage(message, "Max mentions and seconds need to be above 1.");
    }
    const mentions = {
      max_mentions: maxMentions,
      seconds: seconds,
      actions: 0,
      duration: 0,
    };
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      mentions.actions = actions;
      mentions.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.mentions": mentions,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated mention spam module.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.mentions": "" } }
    );
    this.successMessage(message, "Disabled the mention-spam automod.");
  }
}
export default MentionSpam;
