import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { createActionButtons } from "../../utils/AutoModButtons";
import { collections } from "../../core/database/DBClient";

class StickerSpam extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "stickerspam",
      description:
        "Prevent members from spamming stickers in the chat, set stickers to 0 to delete all stickers.",
      usage: "<sticker count/seconds>",
      commands: [
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: ["stickers", "sticker-spam"],
      category: "automod",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
      premiumOnly: true,
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const split = args[0]?.split("/");
    if (!split || split.length < 2) {
      return this.errorMessage(
        message,
        "Specify a valid threshold like: `<sticker count/per seconds>`."
      );
    }
    const maxStickers = parseInt(split[0]);
    const seconds = parseInt(split[1]);
    if (isNaN(maxStickers) || isNaN(seconds)) {
      return this.errorMessage(message, "Max stickers and seconds need to be a number.");
    }
    if (maxStickers < 0 || seconds < 1) {
      return this.errorMessage(
        message,
        "Max stickers must be above or equal to 0 and seconds must be above 1."
      );
    }
    const stickers = {
      max_stickers: maxStickers,
      seconds: seconds,
      actions: 0,
      duration: 0,
    };

    createActionButtons(message, async ({ duration, actions, interaction }) => {
      stickers.actions = actions;
      stickers.duration = duration * 60000;
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "automod.stickers": stickers,
          },
        }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated sticker spam module.`,
        components: [],
      });
    });
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.stickers": "" } }
    );
    this.successMessage(message, "Disabled the sticker-spam automod.");
  }
}
export default StickerSpam;
