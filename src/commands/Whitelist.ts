/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand,
  InteractionDataOptionsSubCommandGroup,
} from "eris";
import { AutoModWhitelistDataTypes, AutoModWhitelistFilterTypes } from "../Constants";
import Command from "../core/structs/ClientCommand";
import { collections } from "../core/database/DBClient";
import logger from "../core/structs/Logger";
import { EmbedBuilder } from "../utils/EmbedBuilder";

const AutoModModules = Object.keys(AutoModWhitelistFilterTypes)
  .filter((x) => x.length > 2)
  .map((x) => x.toLowerCase());

export default class Whitelist extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "whitelist";
  description = "Whitelist specific roles/channels for specific automod modules.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
      name: "add",
      description: "Add a whitelisted channel/role.",
      options: [
        {
          type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
          name: "role",
          description: "Whitelist a role.",
          options: [
            {
              type: Constants.ApplicationCommandOptionTypes.STRING,
              name: "module-name",
              description: "The name of the module",
              choices: AutoModModules.map((mod, index) => ({
                name: mod,
                value: String(index + 1),
              })),
              required: true,
            },
            {
              type: Constants.ApplicationCommandOptionTypes.ROLE,
              name: "role",
              description: "The role to whitelist.",
              required: true,
            },
          ],
        },
        {
          type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
          name: "channel",
          description: "Whitelist a channel.",
          options: [
            {
              type: Constants.ApplicationCommandOptionTypes.STRING,
              name: "module-name",
              description: "The name of the module",
              choices: AutoModModules.map((mod, index) => ({
                name: mod,
                value: String(index + 1),
              })),
              required: true,
            },
            {
              type: Constants.ApplicationCommandOptionTypes.CHANNEL,
              name: "channel",
              description: "The channel to whitelist.",
              required: true,
              channel_types: [Constants.ChannelTypes.GUILD_TEXT, Constants.ChannelTypes.GUILD_NEWS],
            },
          ],
        },
      ],
    },
    {
      type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
      name: "remove",
      description: "Remove a whitelisted channel/role.",
      options: [
        {
          type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
          name: "role",
          description: "Whitelist a role.",
          options: [
            {
              type: Constants.ApplicationCommandOptionTypes.STRING,
              name: "module-name",
              description: "The name of the module",
              choices: AutoModModules.map((mod, index) => ({
                name: mod,
                value: String(index + 1),
              })),
              required: true,
            },
            {
              type: Constants.ApplicationCommandOptionTypes.ROLE,
              name: "role",
              description: "The role to whitelist.",
              required: true,
            },
          ],
        },
        {
          type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
          name: "channel",
          description: "Whitelist a channel.",
          options: [
            {
              type: Constants.ApplicationCommandOptionTypes.STRING,
              name: "module-name",
              description: "The name of the module",
              choices: AutoModModules.map((mod, index) => ({
                name: mod,
                value: String(index + 1),
              })),
              required: true,
            },
            {
              type: Constants.ApplicationCommandOptionTypes.CHANNEL,
              name: "channel",
              description: "The channel to whitelist.",
              required: true,
              channel_types: [Constants.ChannelTypes.GUILD_TEXT, Constants.ChannelTypes.GUILD_NEWS],
            },
          ],
        },
      ],
    },
    {
      type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
      name: "list",
      description: "List whitelisted roles and channels.",
      options: [
        {
          type: Constants.ApplicationCommandOptionTypes.STRING,
          name: "module-name",
          description: "The name of the module",
          choices: AutoModModules.map((mod, index) => ({
            name: mod,
            value: String(index + 1),
          })),
          required: true,
        },
      ],
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.manageGuild.toString();
  dmPermission = false;

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
      | InteractionDataOptionsSubCommandGroup
      | InteractionDataOptionsSubCommand;
    if (subCommandGroup.name === "add" && subCommandGroup.options) {
      const subCommand = subCommandGroup.options[0]! as InteractionDataOptionsSubCommand;
      if (!subCommand.options) {
        return;
      }

      const moduleType = Number(subCommand.options[0]!.value);
      const entityID = subCommand.options[1]!.value as string;

      if (subCommand.name === "role") {
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $push: {
                "automod.whitelist": {
                  data_type: AutoModWhitelistDataTypes.ROLE,
                  filter_type: moduleType,
                  id: entityID,
                },
              },
            },
            { upsert: true }
          )
          .then(() => {
            const role = interaction.data!.resolved!.roles!.get(entityID)!;
            return interaction.createMessage(
              this.successMessage(interaction.channel, `Whitelisted ${role.name} role.`)
            );
          })
          .catch((err) => logger.error("Failed to update whitelist config", err));
      } else if (subCommand.name === "channel") {
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $push: {
                "automod.whitelist": {
                  data_type: AutoModWhitelistDataTypes.CHANNEL,
                  filter_type: moduleType,
                  id: entityID,
                },
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.createMessage(
              this.successMessage(interaction.channel, `Whitelisted <#${entityID}> channel.`)
            );
          })
          .catch((err) => logger.error("Failed to update whitelist config", err));
      }
    } else if (subCommandGroup.name === "remove" && subCommandGroup.options) {
      const subCommand = subCommandGroup.options[0]! as InteractionDataOptionsSubCommand;
      if (!subCommand.options) {
        return;
      }

      const moduleType = Number(subCommand.options[0]!.value);
      const entityID = subCommand.options[1]!.value as string;

      if (subCommand.name === "role") {
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $pull: {
                "automod.whitelist": {
                  id: entityID,
                  data_type: AutoModWhitelistDataTypes.ROLE,
                  filter_type: moduleType,
                },
              },
            },
            { upsert: true }
          )
          .then(() => {
            const role = interaction.data!.resolved!.roles!.get(entityID)!;
            return interaction.createMessage(
              this.successMessage(interaction.channel, `Whitelisted ${role.name} role.`)
            );
          })
          .catch((err) => logger.error("Failed to update whitelist config", err));
      } else if (subCommand.name === "channel") {
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $pull: {
                "automod.whitelist": {
                  id: entityID,
                  data_type: AutoModWhitelistDataTypes.CHANNEL,
                  filter_type: moduleType,
                },
              },
            },
            { upsert: true }
          )
          .then(() => {
            return interaction.createMessage(
              this.successMessage(interaction.channel, `Whitelisted <#${entityID}> channel.`)
            );
          })
          .catch((err) => logger.error("Failed to update whitelist config", err));
      }
    } else if (subCommandGroup.name === "list" && subCommandGroup.options) {
      const guildConfig = await this.client.getGuildConfig(interaction.guildID);
      if (!guildConfig) {
        return interaction.createMessage(
          this.errorMessage(interaction.channel, "Something went wrong...")
        );
      }

      if (!guildConfig.automod || !guildConfig.automod.whitelist) {
        return interaction.createMessage(
          this.errorMessage(interaction.channel, "There is nothing whitelisted.")
        );
      }

      const { roles, channels } = guild;
      const moduleType = Number(subCommandGroup.options[0]!.value);
      const getModuleName = () => AutoModModules[moduleType - 1];

      const whitelist = guildConfig.automod.whitelist.filter((x) => x.filter_type === moduleType);
      if (whitelist.length === 0) {
        return interaction.createMessage(
          this.errorMessage(
            interaction.channel,
            `There are no whitelisted enities for module \`${getModuleName()}\`.`
          )
        );
      }

      const builder = new EmbedBuilder();
      const rolesFormat: string[] = [],
        channelsFormat: string[] = [];
      for (const entity of whitelist) {
        if (entity.data_type === AutoModWhitelistDataTypes.ROLE) {
          if (roles.has(entity.id)) {
            rolesFormat.push(`<@&${entity.id}>`);
          } else {
            rolesFormat.push(entity.id);
          }
        } else {
          if (channels.has(entity.id)) {
            channelsFormat.push(`<#${entity.id}>`);
          } else {
            channelsFormat.push(entity.id);
          }
        }
      }

      builder
        .field("Whitelisted roles:", rolesFormat.join(", ") || "None")
        .field("Whitelisted channels:", channelsFormat.join(", ") || "None")
        .title(`Module: ${getModuleName()}`)
        .color("theme");
      return interaction.createMessage({ embeds: [builder.build()] });
    }
  }
}
