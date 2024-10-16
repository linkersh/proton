import { CustomEmojis } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";
class Toxicity extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "toxicity",
      description:
        "Manage toxicity and prevent members from being toxic.\nThis automod is sensitive, unless your blocking all bad words you should not use it.",
      usage: "<max_score from 40 to 100>",
      aliases: ["toxic"],
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
        `Toxicity score may not be below 40! We recommend you set it to 70+`
      );
    }

    const toxicity = {
      max_score: maxScore / 100,
      actions: 0,
      duration: 0,
    };
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      toxicity.actions = actions;
      toxicity.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.toxicity": toxicity,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated toxicity module.${
          maxScore < 70 ? "\nWe recommend to set the toxicity score above or equal to 70!" : ""
        }`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.toxicity": "" } }
    );
    this.successMessage(message, "Disabled the toxicity automod.");
  }
}
export default Toxicity;
