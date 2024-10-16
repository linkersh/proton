import {
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsBoolean,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import Command from "../core/structs/ClientCommand";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type BoolOpt = InteractionDataOptionsBoolean;

export default class UsernameMod extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "username-mod";
  description = "Username moderator makes nicknames readeable and dehoists them.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.BOOLEAN,
      name: "value",
      description: "Whether the username moderator is enabled or not.",
      required: true,
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

    if (!guildConfig.isPremium) {
      return interaction.createMessage(
        this.errorMessage(
          interaction.channel,
          "This server is not premium. Get premium @ https://proton-bot.net/premium"
        )
      );
    }

    await interaction.acknowledge();

    const value = interaction.data.options![0] as BoolOpt;
    await collections.guildconfigs.updateOne(
      { _id: interaction.guildID },
      { $set: { "automod.modNames": value.value } }
    );

    const toggleStatus = value.value === true ? "enabled." : "disabled.";
    return interaction.createFollowup(
      this.errorMessage(interaction.channel, `Username moderator ${toggleStatus}`)
    );
  }
}
