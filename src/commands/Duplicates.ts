/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand,
} from "eris";
import { FilterDuplicates } from "../core/database/models/GuildConfig";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";
import { collections } from "../core/database/DBClient";
import { CustomEmojis } from "../Constants";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class DuplicateSpam extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "duplicate-spam";
  description = "Configure the duplicate character spam automod module.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Enable & configure actions for this automod module.",
      options: [],
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
      const dupeSpam: FilterDuplicates = {
        actions: 0,
        duration: 0,
      };

      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        dupeSpam.actions = actions;
        dupeSpam.duration = duration * 60000;
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.duplicates": dupeSpam,
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: `${CustomEmojis.GreenTick} Updated the duplicate-spam automod.`,
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommand.name === "disable") {
      collections.guildconfigs
        .updateOne(
          { _id: interaction.guildID },
          { $unset: { "automod.duplicates": "" } },
          { upsert: true }
        )
        .then(() => {
          return interaction.createMessage({
            content: `${CustomEmojis.GreenTick} Disabled the duplicates-spam automod.`,
          });
        })
        .catch((err) => logger.error("Failed to disable automod config", err));
    }
  }
}
