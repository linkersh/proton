import {
  AutocompleteInteraction,
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsWithValue,
  Member,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { getTag, parseDuration } from "../utils/Util";
import logger from "../core/structs/Logger";
import ClientCommand from "../core/structs/ClientCommand";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Ban extends ClientCommand {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "ban";
  description = "Ban or un-ban user(s)";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Ban a user either in this server or outside of the server.",
      options: [
        {
          type: OptionType.USER,
          name: "user",
          description: "The user to ban.",
          required: true,
        },
        {
          type: OptionType.STRING,
          name: "duration",
          description: "The duration of this ban.",
          required: false,
        },
        {
          type: OptionType.STRING,
          name: "delete-days",
          description: "Delete messages for the past N day(s).",
          choices: [
            { name: "1 day", value: "1" },
            { name: "2 days", value: "2" },
            { name: "3 days", value: "3" },
            { name: "4 days", value: "4" },
            { name: "5 days", value: "5" },
            { name: "6 days", value: "6" },
            { name: "7 days", value: "7" },
          ],
        },
        {
          type: OptionType.STRING,
          name: "reason",
          description: "The reason for this ban.",
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "remove",
      description: "Un-ban a previously banned user",
      options: [
        {
          type: OptionType.STRING,
          name: "user",
          description: "The user to un-ban",
          autocomplete: true,
          required: true,
        },
        {
          type: OptionType.STRING,
          name: "reason",
          description: "The reason for this un-ban.",
        },
      ],
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.banMembers.toString();
  dmPermission = false;

  parseDeleteDays(option?: InteractionDataOptionsWithValue) {
    if (option === undefined) {
      return 0;
    }
    if (option.type === OptionType.STRING && option.value) {
      return Number(option.value);
    }
    return 0;
  }

  parseDur(option?: InteractionDataOptionsWithValue) {
    if (option === undefined) {
      return 0;
    }
    if (option.type === OptionType.STRING && option.value) {
      return parseDuration(option.value).duration;
    }
    return 0;
  }

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

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) {
      return;
    }

    const subCommand = interaction.data.options[0];
    if (subCommand.type !== OptionType.SUB_COMMAND) return;
    if (subCommand.options === undefined) return;

    if (subCommand.name === "add") {
      const user = subCommand.options[0];
      if (user.type !== OptionType.USER) return;

      const userValue =
        interaction.data.resolved &&
        interaction.data.resolved.users &&
        interaction.data.resolved.users.get(user.value);

      if (!userValue) {
        return interaction
          .createMessage(
            this.errorMessage(interaction.channel, `Couldn't find the user you're trying to ban.`)
          )
          .catch((err) => logger.error("command: ban: failed to respond to an interaction", err));
      }

      let outsideGuild = true;

      if (interaction.data.resolved && interaction.data.resolved.members) {
        const member = interaction.data.resolved.members.get(user.value);
        if (member) {
          outsideGuild = false;
          const msg = await this.moderation.canPunish(
            guild,
            interaction.member,
            member as Member,
            "ban"
          );
          if (msg.length > 0) {
            return interaction
              .createMessage(this.errorMessage(interaction.channel, msg))
              .catch((err) =>
                logger.error("command: ban: failed to respond to an interaction", err)
              );
          }
        }
      }
      const deleteDays = this.parseDeleteDays(
        subCommand.options.find((opt) => opt.name === "delete-days")
      );
      const duration = this.parseDur(subCommand.options.find((opt) => opt.name === "duration"));
      const reasonOption = subCommand.options.find((opt) => opt.name === "reason");
      let reason = "No reason specified";
      if (
        reasonOption &&
        reasonOption.type === OptionType.STRING &&
        reasonOption.value.length > 0
      ) {
        reason = reasonOption.value;
      }
      return this.moderation
        .banUser(
          guild,
          userValue,
          interaction.member.user,
          guildConfig,
          duration,
          reason,
          deleteDays,
          outsideGuild
        )
        .then(async (banCase) => {
          try {
            await this.moderation.createCase(banCase);
          } catch (err) {
            logger.error("command: ban: failed to create case", err);
          }
          return interaction
            .createMessage(
              this.successMessage(interaction.channel, `**${getTag(userValue)}** has been banned.`)
            )
            .catch((err) => logger.error("command: ban: failed to respond to an interaction", err));
        })
        .catch((err) => {
          logger.error("command: ban: failed to ban member", err);
          return interaction
            .createMessage(this.errorMessage(interaction.channel, (err as Error).message))
            .catch((err) => logger.error("command: ban: failed to respond to an interaction", err));
        });
    } else if (subCommand.name === "remove") {
      const user = subCommand.options[0];
      if (!user || user.type !== OptionType.STRING) {
        return;
      }

      const resolvedUser = await this.moderation.getUser(user.value);
      if (!resolvedUser) {
        return interaction
          .createMessage(this.errorMessage(interaction.channel, `Couldn't find that user!`))
          .catch((err) => logger.error("command: ban: failed to respond to an interaction", err));
      }

      const reasonOption = subCommand.options.find((opt) => opt.name === "reason");
      let reason = "No reason specified";
      if (
        reasonOption &&
        reasonOption.type === OptionType.STRING &&
        reasonOption.value.length > 0
      ) {
        reason = reasonOption.value;
      }
      this.moderation
        .unbanUser(guild, resolvedUser, interaction.member.user, reason)
        .then(async (unbanCase) => {
          try {
            await this.moderation.createCase(unbanCase);
          } catch (err) {
            logger.error("command: ban: failed to create case", err);
          }
          return interaction
            .createMessage(
              this.successMessage(
                interaction.channel,
                `**${getTag(resolvedUser)}** has been un-banned.`
              )
            )
            .catch((err) => logger.error("command: ban: failed to respond to an interaction", err));
        })
        .catch((err) => {
          logger.error("command: ban: failed to un-ban member", err);
          return interaction
            .createMessage(this.errorMessage(interaction.channel, (err as Error).message))
            .catch((err) => logger.error("command: ban: failed to respond to an interaction", err));
        });
    }
  }

  async autoCompleteHandler(interaction: AutocompleteInteraction) {
    if (!interaction.guildID) {
      return;
    }

    const subCommand = interaction.data.options[0];
    if (!subCommand || subCommand.type !== OptionType.SUB_COMMAND) {
      return;
    }

    const searchString = subCommand.options && subCommand.options[0];
    if (!searchString || searchString.type !== OptionType.STRING) {
      return;
    }

    const searchStr = searchString.value.toLowerCase();
    const bans = await this.client.banListCache.getBanList(interaction.guildID);
    const choices = [];
    for (let x = 0; x < bans.length; x++) {
      const ban = bans[x];
      const name = `${getTag(ban.user)} (${ban.user.id})`;
      if (name.toLowerCase().includes(searchStr)) {
        choices.push({
          name: `${getTag(ban.user)} (${ban.user.id})`,
          value: ban.user.id,
        });
      }
      if (choices.length === 25) {
        break;
      }
    }
    interaction.result(choices).catch((err) => {
      logger.error(`command: ban: failed to respond to auto complete interaction`, err);
    });
  }
}
