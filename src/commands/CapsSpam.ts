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
import { FilterCap } from "../core/database/models/GuildConfig";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";
import { collections } from "../core/database/DBClient";
import { CustomEmojis } from "../Constants";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class CapSpam extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "caps-spam";
  description = "Configure the caps spam automod module.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Set threshold for caps spam module.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "max-caps",
          description: "The max amount of caps that can be sent.",
          required: true,
          min_value: 30,
          max_value: 100,
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
      const maxCaps = subCommand.options[0]! as InteractionDataOptionsInteger;

      const capsSpam: FilterCap = {
        max_caps: maxCaps.value,
        actions: 0,
        duration: 0,
      };

      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        capsSpam.actions = actions;
        capsSpam.duration = duration * 60000;
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.caps": capsSpam,
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: `${CustomEmojis.GreenTick} Updated the caps-spam automod.`,
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommand.name === "disable") {
      collections.guildconfigs
        .updateOne({ _id: interaction.guildID }, { $unset: { "automod.caps": "" } })
        .then(() => {
          return interaction.createMessage({
            content: `${CustomEmojis.GreenTick} Disabled the caps-spam automod.`,
          });
        })
        .catch((err) => logger.error("Failed to disable automod config", err));
    }
  }
}
