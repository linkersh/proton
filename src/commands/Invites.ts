/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand,
  InteractionDataOptionsSubCommandGroup,
  InteractionDataOptionsString,
} from "eris";
import { FilterInvites } from "../core/database/models/GuildConfig";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";
import { collections } from "../core/database/DBClient";
import { CustomEmojis } from "../Constants";
import { EmbedBuilder } from "../utils/EmbedBuilder";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

const snowflakeRegex = /^[0-9]{16,19}$/;

export default class Invites extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "invites";
  description = "Configure the server invites automod module.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Configure actions & duration for invites automod module.",
    },
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "ignore",
      description: "Add/remove specific servers from ignore list.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "add",
          description: "Add an ignored server.",
          options: [
            {
              type: OptionType.STRING,
              name: "server-id",
              description: "The server id to ignore.",
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "remove",
          description: "Remove an ignored server.",
          options: [
            {
              type: OptionType.STRING,
              name: "server-id",
              description: "The server id to ignore.",
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "list",
          description: "List the ignored servers.",
          options: [],
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

    const subCommandGroup = interaction.data.options[0]! as
      | InteractionDataOptionsSubCommand
      | InteractionDataOptionsSubCommandGroup;
    if (subCommandGroup.name === "set" && subCommandGroup.options) {
      await interaction.acknowledge();
      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        const invites: FilterInvites = {
          actions: actions,
          duration: duration * 60000,
        };
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.invites": invites,
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: `${CustomEmojis.GreenTick} Updated the invites automod.`,
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommandGroup.name === "ignore" && subCommandGroup.options) {
      const subCommand = subCommandGroup.options[0]! as InteractionDataOptionsSubCommand;
      if (subCommand.name === "add") {
        const serverIDOpt = subCommand.options![0]! as InteractionDataOptionsString;
        if (!snowflakeRegex.test(serverIDOpt.value)) {
          return interaction.createMessage(
            this.errorMessage(interaction.channel, "Invalid server ID specified.")
          );
        }
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            { $addToSet: { "automod.allowedInvites": serverIDOpt.value } },
            { upsert: true }
          )
          .then(() => {
            return interaction.createMessage(
              this.successMessage(
                interaction.channel,
                `Added server id \`${serverIDOpt.value}\` to ignored servers.`
              )
            );
          })
          .catch((err) => logger.error("Failed to add ignored server to invites", err));
      } else if (subCommand.name === "remove") {
        const serverIDOpt = subCommand.options![0]! as InteractionDataOptionsString;
        if (!snowflakeRegex.test(serverIDOpt.value)) {
          return interaction.createMessage(
            this.errorMessage(interaction.channel, "Invalid server ID specified.")
          );
        }
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            { $pull: { "automod.allowedInvites": serverIDOpt.value } },
            { upsert: true }
          )
          .then(() => {
            return interaction.createMessage(
              this.successMessage(
                interaction.channel,
                `Removed server id \`${serverIDOpt.value}\` from ignored servers.`
              )
            );
          })
          .catch((err) => logger.error("Failed to add ignored server to invites", err));
      } else if (subCommand.name === "list") {
        const guildConfig = await this.client.getGuildConfig(interaction.guildID);
        if (!guildConfig) {
          return interaction.createMessage(
            this.errorMessage(interaction.channel, "Something went wrong... Try again later")
          );
        }
        if (
          !guildConfig.automod ||
          !guildConfig.automod.allowedInvites ||
          guildConfig.automod.allowedInvites.length === 0
        ) {
          return interaction.createMessage(
            this.errorMessage(interaction.channel, "There aren't any ignored servers.")
          );
        }
        let output = "";
        for (let i = 0; i < guildConfig.automod.allowedInvites.length; ++i) {
          const guildID = guildConfig.automod.allowedInvites[i];
          output += `${guildID}\n`;
        }
        return interaction.createMessage({
          embeds: [new EmbedBuilder().description(output.slice(0, 4000)).build()],
        });
      }
    } else if (subCommandGroup.name === "disable") {
      collections.guildconfigs
        .updateOne(
          { _id: interaction.guildID },
          { $unset: { "automod.invites": "" } },
          { upsert: true }
        )
        .then(() => {
          return interaction.createMessage({
            content: `${CustomEmojis.GreenTick} Disabled the invites automod.`,
          });
        })
        .catch((err) => logger.error("Failed to disable automod config", err));
    }
  }
}
