/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand,
  InteractionDataOptionsInteger,
} from "eris";
import { FilterSpamEmoji } from "../core/database/models/GuildConfig";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";
import { collections } from "../core/database/DBClient";
import { CustomEmojis } from "../Constants";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class EmojiSpam extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "emoji-spam";
  description = "Configure the emoji spam automod module.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Set threshold for emoji spam module.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "max-emojis",
          description: "The max amount of emojis that can be sent.",
          required: true,
          min_value: 2,
          max_value: 60,
        },
        {
          type: OptionType.INTEGER,
          name: "seconds",
          description: "The time frame between which to record emojis.",
          required: true,
          min_value: 2,
          max_value: 120,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "disable",
      description: "Disable the automod module.",
    },
  ];
  guildID = null;
  dmPermission = false;
  defaultMemberPermissions = Constants.Permissions.manageGuild.toString();

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) {
      return;
    }
    if (!interaction.guildID || !interaction.member) {
      return;
    }

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) {
      return;
    }

    const subCommand = interaction.data.options[0]! as InteractionDataOptionsSubCommand;
    if (subCommand.name === "set" && subCommand.options) {
      await interaction.acknowledge();
      const maxEmojis = subCommand.options[0]! as InteractionDataOptionsInteger;
      const seconds = subCommand.options[1]! as InteractionDataOptionsInteger;

      const emojiSpam: FilterSpamEmoji = {
        max_emojis: maxEmojis.value,
        seconds: seconds.value,
        actions: 0,
        duration: 0,
      };

      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        emojiSpam.actions = actions;
        emojiSpam.duration = duration * 60000;
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.emojis": emojiSpam,
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: `${CustomEmojis.GreenTick} Updated the emoji-spam automod.`,
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommand.name === "disable") {
      collections.guildconfigs
        .updateOne(
          { _id: interaction.guildID },
          { $unset: { "automod.emojis": "" } },
          { upsert: true }
        )
        .then(() => {
          return interaction.createMessage({
            content: `${CustomEmojis.GreenTick} Disabled the emoji-spam automod.`,
          });
        })
        .catch((err) => logger.error("Failed to disable automod config", err));
    }
  }
}
