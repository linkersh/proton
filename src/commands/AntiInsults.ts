import {
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsInteger,
  InteractionDataOptionsSubCommand,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type CommandOpt = InteractionDataOptionsSubCommand;
type IntegerOpt = InteractionDataOptionsInteger;

export default class AntiInsults extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "anti-insults";
  description = "Prevent members from insulting each other by using this auto-mod filter.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Configure anti-insults auto-mod filter.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "max-score",
          description: "The maximum score from 40 to 100 at which proton will punish the user.",
          required: true,
          min_value: 40,
          max_value: 100,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "disable",
      description: "Disable the anti-insults automod filter.",
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
          "This server isn't premium. Get premium @ https://proton-bot.net/premium"
        )
      );
    }

    await interaction.acknowledge();

    const subCommand = interaction.data.options![0] as CommandOpt;
    if (subCommand.name === "set" && subCommand.options) {
      const maxScore = (subCommand.options[0] as IntegerOpt).value;
      createActionButtonsInteraction(interaction, ({ duration, actions, interaction }) => {
        const insults = {
          max_score: maxScore / 100,
          actions: actions,
          duration: duration * 60000,
        };
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            { $set: { "automod.insults": insults } },
            { upsert: true }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: this.successMessage(
                interaction.channel as GuildTextableChannel,
                "Updated the anti-insults automod filter."
              ),
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommand.name === "disable") {
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $unset: { "automod.insults": "" } },
        { upsert: true }
      );
      return interaction.createFollowup(
        this.successMessage(interaction.channel, "Disabled the anti-insults automod filter.")
      );
    }
  }
}
