import { CustomEmojis } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";
class Insults extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "insults",
      description: "Manage insults automod and prevent members from insulting others.",
      usage: "<max_score from 40 to 100>",
      aliases: ["insult"],
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
        `Insutls automod score may not be below 40! We recommend you set it to 70+`
      );
    }
    const insults = {
      max_score: maxScore / 100,
      actions: 0,
      duration: 0,
    };
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      insults.actions = actions;
      insults.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.insults": insults,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated insults module.${
          maxScore < 70 ? "\nWe recommend to set the insults score above or equal to 70!" : ""
        }`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.insults": "" } }
    );
    this.successMessage(message, "Disabled the insults automod.");
  }
}
export default Insults;
