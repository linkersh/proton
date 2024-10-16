import {
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsNumber,
  InteractionDataOptionsString,
  InteractionDataOptionsSubCommand,
} from "eris";
import { AntiAltsActions } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type CommandOpt = InteractionDataOptionsSubCommand;
type NumberOpt = InteractionDataOptionsNumber;
type StringOpt = InteractionDataOptionsString;

export default class AntiAlts extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "anti-alts";
  description = "Punish new users if their account age is too low. Helps prevent alt accounts.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "minimum-age",
      description: "Set the minimum age required to avoid automatic punishment when joining.",
      options: [
        {
          type: OptionType.NUMBER,
          name: "days",
          description: "The minimum age, in days.",
          required: true,
          min_value: 1,
          max_values: 366,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "action",
      description: "Set the punishment action for accounts lower than the required age.",
      options: [
        {
          type: OptionType.STRING,
          name: "type",
          description: "The type of the punishment action.",
          required: true,
          choices: [
            { name: "ban", value: "ban" },
            { name: "kick", value: "kick" },
            { name: "mute", value: "mute" },
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "disable",
      description: "Disable the anti-alts automod filter.",
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

    const subCommand = interaction.data.options![0]! as CommandOpt;
    if (subCommand.name === "minimum-age") {
      const days = (subCommand.options![0] as NumberOpt).value;
      const daysMilliseconds = days * 8.64e7;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $set: { "automod.antiAlts": { minAge: daysMilliseconds } } }
      );
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Minimum account age set to ${days} days.`)
      );
    } else if (subCommand.name === "action") {
      const actionStr = (subCommand.options![0] as StringOpt).value;
      let action: AntiAltsActions;

      if (actionStr === "ban") {
        action = AntiAltsActions.BAN;
      } else if (actionStr === "kick") {
        action = AntiAltsActions.KICK;
      } else {
        action = AntiAltsActions.MUTE;
      }

      await collections.guildconfigs.updateOne(
        {
          _id: interaction.guildID,
        },
        {
          $set: {
            "automod.antiAlts.action": action,
          },
        }
      );
      return interaction.createFollowup(
        this.successMessage(
          interaction.channel,
          `Set punishment action to: ${actionStr} for anti-alts.`
        )
      );
    } else {
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $unset: { "automod.antiAlts": "" } }
      );
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Disabled anti-alts automod filter.`)
      );
    }
  }
}
