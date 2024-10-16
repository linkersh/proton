import { Constants, ModalSubmitInteraction } from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import { TrialStatus } from "../core/database/models/GuildConfig";
import { getTag } from "../utils/Util";
import { REQUESTS_LOGCHANNEL_ID } from "../Constants";
import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";
import { EmbedBuilder } from "../utils/EmbedBuilder";

export default class ModalHandler extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "ModalHandler");
  }

  async onSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.guildID || !interaction.member || !("guild" in interaction.channel)) {
      return;
    }
    if (interaction.data.custom_id.startsWith("trial_deny_")) {
      const guildID = interaction.data.custom_id.slice(11);
      const userID = interaction.data.components[0].components[0].value;
      const reason = interaction.data.components[1].components[0].value;
      try {
        await collections.guildconfigs.updateOne(
          { _id: guildID },
          { $set: { trial_status: TrialStatus.UNAVAILABLE } }
        );
      } catch (err) {
        logger.error("modal handler: failed to make trial unavailable", err);
        return interaction
          .createMessage({
            content: "Failed to make trial unavailable",
            flags: 64,
          })
          .catch((err) => logger.error("modal handler: failed to respond to an interaction", err));
      }
      const guild = await this.client.getGuild(guildID);
      const logEmbed = new EmbedBuilder()
        .color("red")
        .title("Trial Denied")
        .field("Guild:", `${guild?.name} (${guildID})`, true)
        .field("Requester", userID, true)
        .field("Moderator", `${getTag(interaction.member.user)} (${interaction.member.id})`, true)
        .field("Reason", reason.slice(0, 1024), true)
        .timestamp(new Date());
      this.client
        .createMessage(REQUESTS_LOGCHANNEL_ID, {
          embeds: [logEmbed.build()],
        })
        .catch((err) => {
          logger.error("modal handler: failed to send log to request log channel", err);
        });
      let dmSuccess = false;
      try {
        const dmChannel = await this.client.getDMChannel(userID);
        if (dmChannel) {
          await dmChannel.createMessage(
            `Your request to get free premium trial for 3 days has been denied.\nServer: ${
              guild?.name ?? guildID
            }\nReason: ${reason}\nReviewing moderator: ${getTag(
              interaction.member.user
            )}\nIf you believe this is a mistake contact us in our support server: <https://proton-bot.net/support>`
          );
          dmSuccess = true;
        }
      } catch (err) {
        dmSuccess = false;
        logger.warn("modal handler: failed to dm user", err);
      }
      if (dmSuccess) {
        return interaction
          .editParent({
            content: "**Denied**, message sent: true",
            components: [
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: Constants.ComponentTypes.BUTTON,
                    style: Constants.ButtonStyles.SUCCESS,
                    label: "Accept",
                    custom_id: `trial_accept_${interaction.guildID}`,
                    disabled: true,
                  },
                  {
                    type: Constants.ComponentTypes.BUTTON,
                    style: Constants.ButtonStyles.DANGER,
                    label: "Deny",
                    custom_id: `trial_deny_${interaction.guildID}`,
                    disabled: true,
                  },
                ],
              },
            ],
          })
          .catch((err) => logger.error("modal handler: failed to respond to an interaction", err));
      } else {
        return interaction
          .editParent({
            content: "**Denied**, message sent: false",
            components: [
              {
                type: Constants.ComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: Constants.ComponentTypes.BUTTON,
                    style: Constants.ButtonStyles.SUCCESS,
                    label: "Accept",
                    custom_id: `mock_trial_accept`,
                    disabled: true,
                  },
                  {
                    type: Constants.ComponentTypes.BUTTON,
                    style: Constants.ButtonStyles.DANGER,
                    label: "Deny",
                    custom_id: `mock_trial_deny`,
                    disabled: true,
                  },
                ],
              },
            ],
          })
          .catch((err) => logger.error("modal handler: failed to respond to an interaction", err));
      }
    }
  }
}
