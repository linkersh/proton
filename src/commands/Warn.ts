import { CommandInteraction, Constants, GuildTextableChannel } from "eris";
import { PunishmentTypes } from "../Constants";
import { ProtonClient } from "../core/client/ProtonClient";
import ClientCommand from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Warn extends ClientCommand {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "warn";
  description = "Warn a member in this server.";
  options = [
    {
      type: OptionType.USER,
      name: "member",
      description: "The member to warn.",
      required: true,
    },
    {
      type: OptionType.STRING,
      name: "reason",
      description: "The reason of this warn.",
    },
  ];
  guildID = null;
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  defaultMemberPermissions = Constants.Permissions.manageMessages.toString();
  dmPermission = false;

  format(t: PunishmentTypes) {
    if (t === PunishmentTypes.BAN) {
      return "banned";
    } else if (t === PunishmentTypes.MUTE) {
      return "muted";
    } else if (t === PunishmentTypes.KICK) {
      return "kicked";
    } else if (t === PunishmentTypes.WARN) {
      return "warned";
    }
  }

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) return;
    if (!interaction.guildID || !interaction.member) return;

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) return;

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) return;

    const user = interaction.data.options[0];
    if (!user || user.type !== OptionType.USER) return;

    const reasonOption = interaction.data.options[1];
    let reason = "No reason specified.";
    if (reasonOption && reasonOption.type === OptionType.STRING) {
      reason = reasonOption.value;
    }

    const member =
      interaction.data.resolved &&
      interaction.data.resolved.members &&
      interaction.data.resolved.members.get(user.value);
    if (!member) {
      return interaction
        .createMessage(
          this.errorMessage(
            interaction.channel,
            `The user you're trying to warn is not in this server.`
          )
        )
        .catch((err) => logger.error("command: warn: failed to respond to an interaction", err));
    }

    const msg = await this.moderation.canPunish(guild, interaction.member, member, "warn");
    if (msg.length > 0) {
      return interaction
        .createMessage(this.errorMessage(interaction.channel, msg))
        .catch((err) => logger.error("command: warn: failed to respond to an interaction", err));
    }

    let cases;
    try {
      cases = await this.moderation.warnWithThresholds(
        guild,
        member,
        interaction.member.user,
        reason,
        guildConfig
      );
    } catch (err) {
      logger.error("command: warn: failed to warn user with thresholds", err);
      return interaction
        .createMessage(this.errorMessage(interaction.channel, (err as Error).message))
        .catch((err) => logger.error("command: warn: failed to respond to an interaction", err));
    }
    if (!cases) {
      return;
    }

    try {
      await this.moderation.createCase(cases);
    } catch (err) {
      logger.error("command: warn: failed to create cases", err);
      return interaction
        .createMessage(
          this.errorMessage(interaction.channel, `An error occurred! Try again later.`)
        )
        .catch((err) => logger.error("command: warn: failed to respond to an interaction", err));
    }

    let content = `**${member.user.username}#${member.user.discriminator}** has been `;
    if (cases.length > 2) {
      content += cases
        .slice(0, cases.length - 1)
        .map((c) => this.format(c.type))
        .join(", ");
      content += ` and `;

      const last = cases.pop();
      if (last) {
        content += this.format(last.type);
      }
    } else {
      content += cases.map((c) => this.format(c.type)).join(" and ");
    }
    content += ".";
    return interaction.createMessage(this.successMessage(interaction.channel, content));
  }
}
