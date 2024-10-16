import {
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsInteger,
  InteractionDataOptionsString,
  InteractionDataOptionsSubCommand,
} from "eris";
import prettyMilliseconds from "pretty-ms";
import { PunishmentTypes } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import Command from "../core/structs/ClientCommand";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { parseDuration } from "../utils/Util";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type OptSubCommand = InteractionDataOptionsSubCommand;
type OptInteger = InteractionDataOptionsInteger;
type OptString = InteractionDataOptionsString;

export default class Thresholds extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "thresholds";
  description = "Manage warning thresholds.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Add a warning threshold.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "warn-count",
          description: "The maximum amount of warnings until this thresholds triggers.",
          required: true,
          min_value: 1,
          max_value: 32,
        },
        {
          type: OptionType.STRING,
          name: "action",
          description: "The action to apply to the user when they trigger the threshold.",
          required: true,
          choices: [
            { name: "mute", value: "mute" },
            { name: "kick", value: "kick" },
            { name: "ban", value: "ban" },
          ],
        },
        {
          type: OptionType.STRING,
          name: "duration",
          description:
            "The duration of the punishment, only applies when the punishment is mute or ban.",
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "remove",
      description: "Remove a warning threshold.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "warn-count",
          description: "The threshold with this warn-count to remove.",
          required: true,
          min_value: 1,
          max_value: 32,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "List all warning thresholds.",
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

    const subCommand = interaction.data.options![0]! as OptSubCommand;

    if (subCommand.name === "add" && subCommand.options) {
      const warnCount = (subCommand.options[0] as OptInteger).value;
      const action = (subCommand.options[1] as OptString).value;
      const duration = (subCommand.options[2] as OptString | undefined)?.value;

      if (guildConfig.automod && guildConfig.automod.warnThresholds) {
        const existingThreshold = guildConfig.automod.warnThresholds.find(
          (t) => t.warnCount === warnCount
        );
        if (existingThreshold) {
          return interaction.createFollowup(
            this.errorMessage(
              interaction.channel,
              `There is already a warning threshold at \`${warnCount}\` warnings.`
            )
          );
        }
      }

      let actionInt: PunishmentTypes;
      if (action === "ban") {
        actionInt = PunishmentTypes.BAN;
      } else if (action === "kick") {
        actionInt = PunishmentTypes.KICK;
      } else {
        actionInt = PunishmentTypes.MUTE;
      }

      let durationInt = 0;
      if (duration) {
        if (action === "kick") {
          return interaction.createFollowup(
            this.errorMessage(
              interaction.channel,
              `You can't specify a duration for the \`kick\` punishment action.`
            )
          );
        }

        const time = parseDuration(duration);
        if (!time || isNaN(time.duration)) {
          return interaction.createFollowup(
            this.errorMessage(
              interaction.channel,
              `"${duration}" is invalid duration, specify a valid duration ex: \`10 hours\``
            )
          );
        }
        durationInt = time.duration;
      }

      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        {
          $push: {
            "automod.warnThresholds": {
              warnCount: warnCount,
              action: actionInt,
              duration: durationInt,
            },
          },
        }
      );
      return interaction.createFollowup(
        this.successMessage(
          interaction.channel,
          `Added a new warning thresholds which will trigger at \`${warnCount}\` warnings and ${action} the offender.`
        )
      );
    } else if (subCommand.name === "remove" && subCommand.options) {
      const warnCount = (subCommand.options[0] as OptInteger).value;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        {
          $pull: {
            "automod.warnThresholds": {
              warnCount,
            },
          },
        }
      );
      return interaction.createFollowup(
        this.successMessage(
          interaction.channel,
          `Removed a warning threshold which triggered at \`${warnCount}\` warnings.`
        )
      );
    } else {
      if (
        !guildConfig.automod ||
        !guildConfig.automod.warnThresholds ||
        guildConfig.automod.warnThresholds.length === 0
      ) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "There aren't any warning thresholds created.")
        );
      }
      const { warnThresholds } = guildConfig.automod;
      const builder = new EmbedBuilder()
        .title("Warning Thresholds")
        .color("theme")
        .footer(`${warnThresholds.length} thresholds`);
      let desc = "";

      const sortedThresholds = warnThresholds.sort((a, b) => a.warnCount - b.warnCount);
      for (const threshold of sortedThresholds) {
        desc += this.formatPunishment(threshold.action);
        if (threshold.action !== PunishmentTypes.KICK && threshold.duration > 0) {
          desc += `for ${prettyMilliseconds(threshold.duration)} `;
        }
        desc += `when they reach **${threshold.warnCount}** warnings\n`;
      }
      builder.description(desc);
      return interaction.createFollowup({ embeds: [builder.build()] });
    }
  }

  formatPunishment(action: PunishmentTypes) {
    if (action === PunishmentTypes.BAN) {
      return "`ban` user ";
    } else if (action === PunishmentTypes.KICK) {
      return "`kick` user ";
    } else if (action === PunishmentTypes.MUTE) {
      return "`mute` user ";
    }
    return "unknown action";
  }
}
