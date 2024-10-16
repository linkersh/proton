import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants } from "eris";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { MessageRaidLevel } from "../core/database/models/GuildConfig";
import { collections } from "../core/database/DBClient";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { parseDuration } from "../utils/Util";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class SpamRaid extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "spam-raid";
  description = "Protect your server from message raids.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Add a spam-raid level.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "max-messages",
          description: "Maximum amount of messages that can be sent.",
          required: true,
          min_value: 5,
          max_value: 60,
        },
        {
          type: OptionType.INTEGER,
          name: "seconds",
          description: "The time frame in seconds to record messages between",
          required: true,
          min_value: 5,
          max_value: 120,
        },
        {
          type: OptionType.INTEGER,
          name: "slowmode",
          description: "The slowmode to set in the channel with too many messages.",
          min_value: 1,
          max_value: 21600,
        },
        {
          type: OptionType.STRING,
          name: "lockdown-time",
          description: "The duration to keep all the channels locked for.",
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "delete",
      description: "Delete a spam-raid level.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "id",
          description: "The id of the spam-raid level.",
          required: true,
          min_value: 1,
          max_value: 5,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "List all spam-raid levels.",
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.manageGuild.toString();
  dmPermission = false;

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    await interaction
      .acknowledge()
      .catch((err) => logger.error("command: button-roles: failed to ack an interaction", err));

    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    if (!guildConfig.isPremium) {
      return interaction.createFollowup(
        this.errorMessage(
          interaction.channel,
          "This command is only available for premium servers. Get premium @ https://proton-bot.net/premium"
        )
      );
    }

    const subCommand = interaction.data.options && interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) return;

    if (subCommand.name === "add" && subCommand.options !== undefined) {
      if (
        guildConfig.automod &&
        guildConfig.automod.messageRaidLevels &&
        guildConfig.automod.messageRaidLevels.length > 5
      ) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "You can't add more than 5 levels.")
        );
      }

      const maxMessagesOpt = subCommand.options[0];
      if (!maxMessagesOpt || maxMessagesOpt.type !== OptionType.INTEGER) return;
      const secondsOpt = subCommand.options[1];
      if (!secondsOpt || secondsOpt.type !== OptionType.INTEGER) return;

      const maxMessages = maxMessagesOpt.value;
      const seconds = maxMessagesOpt.value;
      const level: MessageRaidLevel = { maxMessages, seconds };
      const lockdownOpt = subCommand.options.find((x) => x.name === "lockdown-time");
      if (lockdownOpt && lockdownOpt.type === OptionType.STRING) {
        const dur = parseDuration(lockdownOpt.value);
        if (!dur || dur.duration < 60_000) {
          return interaction.createMessage(
            this.errorMessage(
              interaction.channel,
              "Invalid lockdown duration, must be at least 1 minute."
            )
          );
        }
        level.lockdownTime = dur.duration;
      }

      const slowmodeOpt = subCommand.options.find((x) => x.name === "slowmode");
      if (slowmodeOpt && slowmodeOpt.type === OptionType.INTEGER) {
        level.slowmode = slowmodeOpt.value;
      }

      if (!level.slowmode && !level.lockdownTime) {
        return interaction.createFollowup(
          this.errorMessage(
            interaction.channel,
            "You must choose at least one of: lockdown time, slowmode."
          )
        );
      }

      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $push: { "automod.messageRaidLevels": level } }
      );

      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Added a new spam-raid level.`)
      );
    } else if (subCommand.name === "delete" && subCommand.options !== undefined) {
      if (
        guildConfig.automod &&
        guildConfig.automod.messageRaidLevels &&
        guildConfig.automod.messageRaidLevels.length > 5
      ) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "You can't add more than 5 levels.")
        );
      }

      const idOpt = subCommand.options && subCommand.options[0];
      if (!idOpt || idOpt.type !== OptionType.INTEGER) return;

      if (
        !guildConfig.automod ||
        !guildConfig.automod.messageRaidLevels ||
        !guildConfig.automod.messageRaidLevels[idOpt.value - 1]
      ) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, `Level with id: \`${idOpt.value}\` doesn't exist.`)
        );
      }

      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        {
          $pull: {
            "automod.messageRaidLevels": guildConfig.automod.messageRaidLevels[idOpt.value - 1],
          },
        }
      );
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Removed the level with id: \`${idOpt.value}\``)
      );
    } else if (subCommand.name === "list") {
      if (!guildConfig.automod || !guildConfig.automod.messageRaidLevels) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "No spam-raid levels created.")
        );
      }
      let desc = "";
      for (const level of guildConfig.automod.messageRaidLevels) {
        const strings = [];
        if (level.slowmode) {
          strings.push(`Set slowmode: **${level.slowmode}s**`);
        }
        if (level.lockdownTime) {
          strings.push(`Lockdown: **${level.lockdownTime}min**`);
        }
        const out = `${strings.join(" and ")} after **${level.maxMessages}** messages in **${
          level.seconds
        }s**\n`;
        desc += out;
      }
      const builder = new EmbedBuilder()
        .title("Message raid levels")
        .description(desc)
        .color("theme");
      return interaction.createFollowup({ embeds: [builder.build()] });
    }
  }
}
