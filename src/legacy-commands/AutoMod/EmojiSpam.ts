import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import { CustomEmojis } from "../../Constants";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";

class EmojiSpam extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "emojispam",
      description: "Prevent users from spamming/using too many emojis with this automod module.",
      usage: "<max emojis/seconds>",
      commands: [
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: ["emoji-spam", "emojis"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const split = args[0]?.split("/");
    if (!split || split.length < 2) {
      return this.errorMessage(
        message,
        "Specify a valid threshold like: `<emoji count/per seconds>`."
      );
    }
    const maxEmojis = parseInt(split[0]);
    const seconds = parseInt(split[1]);
    if (isNaN(maxEmojis) || isNaN(seconds)) {
      return this.errorMessage(message, "Max emojis and seconds must be a number and above 0.");
    }
    if (maxEmojis < 1 || seconds < 1) {
      return this.errorMessage(message, "Max emojis and seconds must be above 0.");
    }
    const emojiSpam = {
      max_emojis: maxEmojis,
      seconds: seconds,
      actions: 0,
      duration: 0,
    };
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      emojiSpam["actions"] = actions;
      if (duration > 0) {
        emojiSpam["duration"] = duration * 60000;
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.emojis": emojiSpam } }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Emoji-spam automod has been updated.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.emojis": "" } }
    );
    this.successMessage(message, "Disabled the emoji-spam automod.");
  }
}
export default EmojiSpam;
