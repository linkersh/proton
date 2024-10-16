import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";
class Duplicates extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "duplicates",
      description: "Prevent members from repeating specific words and/or characters.",
      usage: "",
      commands: [
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: ["dupes"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  execute({ message }: ExecuteArgs) {
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      const duplicates = {
        actions: actions,
        duration: 0,
      };
      if (duration > 0) {
        duplicates["duration"] = duration * 60000;
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.duplicates": duplicates } }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated duplicates automod module.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.duplicates": "" } }
    );
    this.successMessage(message, "Disabled the duplicates automod.");
  }
}
export default Duplicates;
