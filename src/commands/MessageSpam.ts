/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand,
  InteractionDataOptionsInteger,
} from "eris";
import Command from "../core/structs/ClientCommand";
import { FilterSpamMessage } from "../core/database/models/GuildConfig";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";
import { collections } from "../core/database/DBClient";
import logger from "../core/structs/Logger";
import { CustomEmojis } from "../Constants";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class MessageSpam extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "message-spam";
  description = "Configure the message spam automod module.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Set threshold for message spam module.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "max-messages",
          description: "The max amount of message that can be sent.",
          required: true,
          min_value: 2,
          max_value: 60,
        },
        {
          type: OptionType.INTEGER,
          name: "seconds",
          description: "The time frame between which to record messages.",
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
      const maxMessages = subCommand.options[0]! as InteractionDataOptionsInteger;
      const seconds = subCommand.options[1]! as InteractionDataOptionsInteger;

      const messageSpam: FilterSpamMessage = {
        max_messages: maxMessages.value,
        seconds: seconds.value,
        actions: 0,
        duration: 0,
      };

      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        messageSpam.actions = actions;
        messageSpam.duration = duration * 60000;
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.spam": messageSpam,
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: `${CustomEmojis.GreenTick} Updated the message-spam automod.`,
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommand.name === "disable") {
      collections.guildconfigs
        .updateOne(
          { _id: interaction.guildID },
          { $unset: { "automod.spam": "" } },
          { upsert: true }
        )
        .then(() => {
          return interaction.createMessage({
            content: `${CustomEmojis.GreenTick} Disabled the message-spam automod.`,
          });
        })
        .catch((err) => logger.error("Failed to disable automod config", err));
    }
  }
}
