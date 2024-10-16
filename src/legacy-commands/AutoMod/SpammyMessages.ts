import { CustomEmojis } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";
class SpammyMessages extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "spammy-msgs",
      description: "Prevent members from sending spam/scam messages in the chat.",
      usage: "<max_score from 40 to 100>",
      aliases: ["spammy"],
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
  async execute({ message, args }: ExecuteArgs) {
    const maxScore = parseInt(args[0]);
    if (isNaN(maxScore)) {
      return this.errorMessage(message, `"${maxScore || ""}" is not a valid integer.`);
    }
    if (maxScore > 100) {
      return this.errorMessage(message, `Max score can't be above 100.`);
    }
    if (maxScore < 40) {
      return this.errorMessage(
        message,
        `Spam message score may not be below 40! We recommend you set it to 70+`
      );
    }

    const spamMessages = {
      max_score: maxScore / 100,
      actions: 0,
      duration: 0,
    };
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      spamMessages.actions = actions;
      spamMessages.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.spam_messages": spamMessages,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated spammy messages module.${
          maxScore < 70
            ? "\nWe recommend to set the spammy messages score above or equal to 70!"
            : ""
        }`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.spam_messages": "" } }
    );
    this.successMessage(message, "Disabled the spammy messages automod.");
  }
}
export default SpammyMessages;
