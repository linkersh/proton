import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";
class MassCaps extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "caps",
      description: "Confgiure maximum automod.",
      usage: "<caps percentage 30-100>",
      commands: [
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: ["masscaps"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const percentage = parseInt(args[0]);
    if (isNaN(percentage)) {
      return this.errorMessage(message, "Percentage must be a number and above 30.");
    }
    if (percentage < 30) {
      return this.errorMessage(message, "Percentage must be above 30.");
    }
    if (percentage > 100) {
      return this.errorMessage(message, "Caps percentage must be below or equal to 100.");
    }

    createActionButtons(message, async ({ duration, actions, interaction }) => {
      const caps = {
        max_caps: percentage,
        actions: actions,
        duration: 0,
      };
      if (duration) {
        caps.duration = duration * 60000;
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.caps": caps } }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated cap lock spam automod.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.caps": "" } }
    );
    this.successMessage(message, "Disabled the caps automod.");
  }
}
export default MassCaps;
