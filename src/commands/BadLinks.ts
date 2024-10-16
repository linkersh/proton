import {
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsBoolean,
  InteractionDataOptionsString,
  InteractionDataOptionsSubCommand,
  InteractionDataOptionsSubCommandGroup,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import { FilterLinks } from "../core/database/models/GuildConfig";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type BoolOpt = InteractionDataOptionsBoolean;
type CommandOpt = InteractionDataOptionsSubCommand;
type CommandGroupOpt = InteractionDataOptionsSubCommandGroup;
type StringOpt = InteractionDataOptionsString;

export default class BadLinks extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "bad-links";
  description = "Blacklist specific domains and limit links to https only.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "blacklist-domains",
      description: "Add/remove blacklisted domains.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "add",
          description: "Add a domain to list of blacklisted domains.",
          options: [
            {
              type: OptionType.STRING,
              name: "domain",
              description: "The domain to blacklist.",
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "remove",
          description: "Remove a blacklisted domain.",
          options: [
            {
              type: OptionType.STRING,
              name: "domain",
              description: "The domain to remove from blacklist.",
              required: true,
            },
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "https-only",
      description: "Toggle https-only mode.",
      options: [
        {
          type: OptionType.BOOLEAN,
          name: "value",
          description: "Enable/disable https-only mode.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Configure punishment actions for bad-links automod filter.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "disable",
      description: "Disable bad-links automod filter.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "panel",
      description: "View config panel for bad-links automod filter.",
    },
  ];
  guildID = null;
  dmPermission = false;
  defaultMemberPermissions = Constants.Permissions.manageGuild.toString();

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    await interaction.acknowledge();

    const commandOrGroup = interaction.data.options[0] as CommandOpt | CommandGroupOpt;
    let additionalMessage = "";
    if (!guildConfig.automod || !guildConfig.automod.links) {
      additionalMessage = "\nDon't forget to use `/bad-links set` to enable bad-links module.";
    }

    if (
      commandOrGroup.type === OptionType.SUB_COMMAND_GROUP &&
      commandOrGroup.name === "blacklist-domains"
    ) {
      const subCommand = commandOrGroup.options[0] as CommandOpt;
      const domain = (subCommand.options![0]! as StringOpt).value;
      if (subCommand.name === "add") {
        if (
          guildConfig.automod &&
          guildConfig.automod.bad_domains &&
          guildConfig.automod.bad_domains.length >= 100
        ) {
          return interaction.createFollowup(
            this.errorMessage(
              interaction.channel,
              `You cannot add more than 100 blacklisted domains.`
            )
          );
        }

        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $push: { "automod.bad_domains": domain } }
        );
        return interaction.createFollowup(
          this.successMessage(interaction.channel, `Added ${domain} to blacklisted domains.${additionalMessage}`)
        );
      } else if (subCommand.name === "remove") {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $pull: { "automod.bad_domains": domain } }
        );
        return interaction.createFollowup(
          this.successMessage(interaction.channel, `Removed ${domain} from blacklisted domains.${additionalMessage}`)
        );
      }
    } else if (
      commandOrGroup.type === OptionType.SUB_COMMAND &&
      commandOrGroup.name === "https-only"
    ) {
      const value = (commandOrGroup.options![0]! as BoolOpt).value;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $pull: { "automod.links_https_only": value } }
      );
      const toggleFmt = value === true ? "Enabled" : "Disabled";
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `${toggleFmt} https-only mode.${additionalMessage}`)
      );
    } else if (commandOrGroup.type === OptionType.SUB_COMMAND && commandOrGroup.name === "set") {
      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        const invites: FilterLinks = {
          actions: actions,
          duration: duration * 60000,
        };
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.links": invites,
              },
            }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: this.successMessage(interaction.channel, "Updated the bad links automod."),
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (
      commandOrGroup.type === OptionType.SUB_COMMAND &&
      commandOrGroup.name === "disable"
    ) {
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        {
          $unset: {
            "automod.links": "",
            "automod.links_https_only": "",
            "automod.bad_domains": "",
          },
        }
      );
      return interaction.createFollowup({
        content: this.successMessage(interaction.channel, "Updated the bad links automod."),
      });
    } else if (commandOrGroup.type === OptionType.SUB_COMMAND && commandOrGroup.name === "panel") {
      let domains = "";
      if (
        guildConfig.automod &&
        guildConfig.automod.bad_domains &&
        guildConfig.automod.bad_domains.length > 0
      ) {
        for (const domain of guildConfig.automod.bad_domains) {
          domains += domain;
          domains += "\n";
        }
      }
      return interaction.createFollowup("", {
        file: `HTTPS only: ${
          guildConfig?.automod?.links_https_only ?? "false"
        }\nList of blacklisted domains:\n${domains}`,
        name: "config.txt",
      });
    }
  }
}
