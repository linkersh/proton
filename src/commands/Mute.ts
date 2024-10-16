import {
  AutocompleteInteraction,
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsWithValue,
  Member,
} from "eris";
import { ModerationTypes } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import { getTag, parseDuration } from "../utils/Util";
import prettyMilliseconds from "pretty-ms";
import ClientCommand from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Mute extends ClientCommand {
  constructor(client: ProtonClient) {
    super(client);
  }

  name = "mute";
  description = "Mute or un-mute a server member.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Mute a server member.",
      options: [
        {
          type: OptionType.USER,
          name: "member",
          description: "The member that should be muted.",
          required: true,
        },
        {
          type: OptionType.STRING,
          name: "duration",
          description: "The duration of this mute.",
          required: false,
        },
        {
          type: OptionType.STRING,
          name: "reason",
          description: "The reason of this mute.",
          required: false,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "remove",
      description: "Un-mute a server member.",
      options: [
        {
          type: OptionType.STRING,
          name: "member",
          description: "The member that should be un-muted.",
          required: true,
          autocomplete: true,
        },
        {
          type: OptionType.STRING,
          name: "reason",
          description: "The reason of this un-mute.",
          required: false,
        },
      ],
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.moderateMembers.toString();
  dmPermission = false;

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
    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    const subCommand = interaction.data.options[0];
    if (subCommand.type !== OptionType.SUB_COMMAND || subCommand.options === undefined) return;

    if (subCommand.name === "add") {
      const memberOption = subCommand.options[0];
      if (!memberOption || memberOption.type !== OptionType.USER) return;

      const memberResolved =
        interaction.data.resolved &&
        interaction.data.resolved.members &&
        interaction.data.resolved.members.get(memberOption.value);
      if (!memberResolved) {
        return interaction
          .createMessage(
            this.errorMessage(
              interaction.channel,
              "The member you're trying to mute is not in this server."
            )
          )
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
      }

      const msg = await this.moderation.canPunish(
        guild,
        interaction.member,
        memberResolved as Member,
        "mute"
      );

      if (msg.length > 0) {
        return interaction
          .createMessage(this.errorMessage(interaction.channel, msg))
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
      }

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

      let muteCase;
      try {
        muteCase = await this.moderation.muteUser(
          guild,
          memberResolved as Member,
          interaction.member.user,
          guildConfig,
          duration,
          reason
        );
      } catch (err) {
        return interaction
          .createMessage(this.errorMessage(interaction.channel, (err as Error).message))
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
      }

      if (!muteCase) {
        return;
      }

      try {
        await this.moderation.createCase(muteCase);
      } catch (err) {
        logger.error("command: mute: failed to create mute case", err);
        return interaction
          .createMessage(
            this.errorMessage(interaction.channel, `An error occurred! Try again later.`)
          )
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
      }

      return interaction
        .createMessage(
          this.successMessage(
            interaction.channel,
            `**${getTag(memberResolved)}** has been muted${
              duration ? ` for ${prettyMilliseconds(duration)}` : "."
            }`
          )
        )
        .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
    } else if (subCommand.name === "remove") {
      const memberOption = subCommand.options[0];
      if (!memberOption || memberOption.type !== OptionType.STRING) return;

      let member = guild.members.get(memberOption.value);
      if (!member) {
        try {
          member = await this.client.getRESTGuildMember(guild.id, memberOption.value);
        } catch (err) {
          logger.error("command: mute: failed to fetch guild member", err);
          member = undefined;
        }
        if (!member) {
          return interaction.createMessage(
            this.errorMessage(
              interaction.channel,
              "The user you're trying to un-mute is not in this server."
            )
          );
        }
      }

      const msg = await this.moderation.canPunish(guild, interaction.member, member, "unmute");
      if (msg.length > 0) {
        return interaction
          .createMessage(this.errorMessage(interaction.channel, msg))
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
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

      let unmuteCase;
      try {
        unmuteCase = await this.moderation.unmuteUser(
          guild,
          member,
          interaction.member.user,
          guildConfig,
          reason
        );
      } catch (err) {
        logger.error("command: mute: failed to un-mute user", err);
        return interaction
          .createMessage(this.errorMessage(interaction.channel, (err as Error).message))
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
      }

      if (!unmuteCase) {
        return;
      }

      try {
        await this.moderation.createCase(unmuteCase);
      } catch (err) {
        logger.error("command: mute: failed to create unmute case", err);
        return interaction
          .createMessage(
            this.errorMessage(interaction.channel, `An error occurred! Try again later.`)
          )
          .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
      }

      return interaction
        .createMessage(
          this.successMessage(interaction.channel, `**${getTag(member)}** has been un-muted`)
        )
        .catch((err) => logger.error("command: mute: failed to respond to an interaction", err));
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

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const searchString = subCommand.options && subCommand.options[0];
    if (!searchString || searchString.type !== OptionType.STRING) {
      return;
    }

    const searchStr = searchString.value.toLowerCase();
    let moderations;
    try {
      moderations = (await collections.moderations
        .aggregate([
          {
            $match: {
              guildID: guild.id,
              type: {
                $in: [ModerationTypes.TEMPMUTE, ModerationTypes.MUTE],
              },
            },
          },
          { $group: { _id: "$userID" } },
          { $limit: 30 },
          { $project: { userID: 1 } },
        ])
        .toArray()) as { _id: string }[];
    } catch (err) {
      logger.error("command: mute: autocomplete: failed to fetch moderations", err);
    }

    if (!moderations || moderations.length === 0) {
      return interaction.result([]).catch((err) => {
        logger.error(`command: ban: failed to respond to auto complete interaction`, err);
      });
    }

    const uncachedIDs = [];
    const members: Member[] = [];
    for (let x = 0; x < moderations.length; x++) {
      const mod = moderations[x];
      const member = guild.members.get(mod._id);
      if (!member) {
        uncachedIDs.push(mod._id);
      } else {
        members.push(member);
      }
    }

    if (uncachedIDs.length > 0) {
      let fetchedUncached;
      try {
        fetchedUncached = await guild.fetchMembers({
          userIDs: uncachedIDs,
        });
      } catch (err) {
        logger.error("command: mute: autocomplete: failed to request for guild members", err);
      }
      if (fetchedUncached && fetchedUncached.length > 0) {
        members.push(...fetchedUncached);
      }
    }

    if (members.length === 0) {
      return;
    }

    const choices = [];
    for (let x = 0; x < members.length; x++) {
      const member = members[x];
      if (!guild.members.has(member.id)) {
        guild.members.add(member, guild, true);
      }

      const name = `${getTag(member.user)} (${member.user.id})`;
      if (name.toLowerCase().includes(searchStr)) {
        choices.push({ name: name, value: member.user.id });
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
