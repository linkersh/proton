import { CommandInteraction, Constants, GuildTextableChannel, Member } from "eris";
import { getTag } from "../utils/Util";
import type { ProtonClient } from "../core/client/ProtonClient";
import ClientCommand from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Kick extends ClientCommand {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "kick";
  description = "Kick a member from the server.";
  options = [
    {
      type: OptionType.USER,
      name: "user",
      description: "The user to kick.",
      required: true,
    },
    {
      type: OptionType.STRING,
      name: "reason",
      description: "The reason for this kick.",
    },
  ];
  guildID = null;
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  defaultMemberPermissions = Constants.Permissions.kickMembers.toString();
  dmPermission = false;

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
            `The user you're trying to kick is not in this server.`
          )
        )
        .catch((err) => logger.error("command: kick: failed to respond to an interaction", err));
    }

    const msg = await this.moderation.canPunish(
      guild,
      interaction.member,
      member as Member,
      "kick"
    );
    if (msg.length > 0) {
      return interaction
        .createMessage(this.errorMessage(interaction.channel, msg))
        .catch((err) => logger.error("command: kick: failed to respond to an interaction", err));
    }

    let kickCase;
    try {
      kickCase = await this.moderation.kickUser(
        guild,
        member as Member,
        interaction.member.user,
        guildConfig,
        reason
      );
    } catch (err) {
      logger.error("command: kick: failed to kick user", err);
      return interaction
        .createMessage(this.errorMessage(interaction.channel, (err as Error).message))
        .catch((err) => logger.error("command: kick: failed to respond to an interaction", err));
    }

    if (!kickCase) {
      return;
    }

    try {
      await this.moderation.createCase(kickCase);
    } catch (err) {
      logger.error("command: kick: failed to create kick case", err);
      return interaction
        .createMessage(this.errorMessage(interaction.channel, `An error occurred!`))
        .catch((err) => logger.error("command: kick: failed to respond to an interaction", err));
    }

    return interaction
      .createMessage(
        this.successMessage(interaction.channel, `**${getTag(member)}** has been kicked.`)
      )
      .catch((err) => logger.error("command: kick: failed to respond to an interaction", err));
  }
}
