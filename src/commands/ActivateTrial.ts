import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants } from "eris";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { collections } from "../core/database/DBClient";
import { TrialStatus } from "../core/database/models/GuildConfig";
export default class ActivateTrial extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "activate-trial";
  description = "Activate premium trial.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [];
  guildID = null;
  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (!interaction.member || !interaction.guildID) {
      return;
    }

    try {
      await interaction.acknowledge();
    } catch (err) {
      logger.error("command: activate-trial: failed to acknowledge an interaction", err);
      return;
    }
    if (!interaction.member.permissions.has("administrator")) {
      return interaction
        .createFollowup(
          this.errorMessage(
            interaction.channel,
            `You don't have enough permissions in this **guild**.`
          )
        )
        .catch((err) =>
          logger.error("command: activate-trial: failed to respond to an interaction", err)
        );
    }

    const guildConfig = await this.client.getGuildConfig(interaction.guildID);
    if (!guildConfig) {
      return;
    }
    if (guildConfig.trial_status === TrialStatus.UNAVAILABLE) {
      return interaction
        .createFollowup({
          content: this.errorMessage(
            interaction.channel,
            "Trial has already been used in this server. Consider getting [Premium](<https://proton-bot.net/premium>)"
          ),
        })
        .catch((err) =>
          logger.error("command: activate-trial: failed to respond to interaction", err)
        );
    }
    if (guildConfig.trial_status === TrialStatus.ACTIVATED) {
      return interaction
        .createFollowup({
          content: this.errorMessage(interaction.channel, "Trial already activated."),
        })
        .catch((err) =>
          logger.error("command: activate-trial: failed to respond to interaction", err)
        );
    }
    try {
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        {
          $set: {
            trial_status: TrialStatus.ACTIVATED,
            trial_start: new Date(),
            isPremium: true,
          },
        }
      );
    } catch (err) {
      return interaction
        .createFollowup({
          content: this.errorMessage(interaction.channel, "Something went wrong..."),
        })
        .catch((err) =>
          logger.error("command: activate-trial: failed to respond to interaction", err)
        );
    }
    return interaction
      .createFollowup({
        content: this.successMessage(interaction.channel, "Trial activated!"),
      })
      .catch((err) =>
        logger.error("command: activate-trial: failed to respond to interaction", err)
      );
  }
}
