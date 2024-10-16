import {
  CommandInteraction,
  Constants,
  GuildTextableChannel,
  InteractionDataOptionsString,
  InteractionDataOptionsSubCommand,
} from "eris";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import { BadWord } from "../core/database/models/GuildConfig";
import Command from "../core/structs/ClientCommand";
import logger from "../core/structs/Logger";
import { createActionButtonsInteraction } from "../utils/AutoModButtons";
import { sensorWord } from "../utils/Util";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

type StringOpt = InteractionDataOptionsString;
type SubCommandOpt = InteractionDataOptionsSubCommand;

export default class BlacklistWords extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "blacklist-words";
  description = "AutoMod module to blacklist specific words.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "add",
      description: "Add a word to blacklist.",
      options: [
        {
          type: OptionType.STRING,
          name: "word",
          description: "The word to blacklist.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "remove",
      description: "Remove a word from blacklist.",
      options: [
        {
          type: OptionType.STRING,
          name: "word",
          description: "The word to remove from blacklist.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "set",
      description: "Set punishment actions when a member says a blacklisted word.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "list",
      description: "View all blacklisted words.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "disable",
      description: "Disable this automod module.",
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

    const subCommand = interaction.data.options![0] as SubCommandOpt;
    if (subCommand.name === "add" && subCommand.options) {
      const badwordStr = (subCommand.options[0] as StringOpt).value;
      if (badwordStr.length < 3) {
        return interaction.createFollowup(
          this.errorMessage(
            interaction.channel,
            "The word needs to be at least 3 characters in length."
          )
        );
      }
      if (badwordStr.length > 128) {
        return interaction.createFollowup(
          this.errorMessage(
            interaction.channel,
            "The word needs to be shorter or equal to 128 characters in length."
          )
        );
      }

      if (
        guildConfig.automod &&
        guildConfig.automod.badwordList &&
        guildConfig.automod.badwordList.length >= 50
      ) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "You can't add more than 50 blacklisted words.")
        );
      }

      const badword: BadWord = { text: badwordStr, exact_match: true };
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $addToSet: { "automod.badwordList": badword } }
      );
      const word = sensorWord(badwordStr);
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Blacklisted the \`${word}\` word.`)
      );
    } else if (subCommand.name === "remove" && subCommand.options) {
      const badwordStr = (subCommand.options[0] as StringOpt).value;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $pull: { "automod.badwordList": { text: badwordStr } } }
      );
      const word = sensorWord(badwordStr);
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `\`${word}\` is no longer blacklisted.`)
      );
    } else if (subCommand.name === "set") {
      createActionButtonsInteraction(interaction, ({ duration, actions }) => {
        const badwords = {
          actions,
          duration: 0,
        };
        if (duration > 0) {
          badwords["duration"] = duration * 60000;
        }
        collections.guildconfigs
          .updateOne(
            { _id: interaction.guildID },
            {
              $set: {
                "automod.badwords": badwords,
              },
            }
          )
          .then(() => {
            return interaction.editOriginalMessage({
              content: this.successMessage(
                interaction.channel,
                `Updated the blacklisted automod module.`
              ),
              components: [],
            });
          })
          .catch((err) => logger.error("Failed to save automod config", err));
      });
    } else if (subCommand.name === "list") {
      if (!guildConfig.automod?.badwordList?.length) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "There aren't any blacklisted words.")
        );
      }

      const words = guildConfig.automod.badwordList.map((x) => x.text);
      let currentString = `Blacklisted words in: ${interaction.channel.guild.name}:\n`;
      for (const word of words) {
        const stringToAdd = `\`${word}\` `;
        currentString += stringToAdd;
      }
      if (currentString.length > 2000) {
        return interaction.createFollowup("", [{ file: currentString, name: "badwords.txt" }]);
      } else {
        return interaction.createFollowup(currentString);
      }
    } else if (subCommand.name === "disable") {
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $unset: { "automod.badwords": "" } }
      );
      return interaction.createFollowup(
        this.successMessage(interaction.channel, "Disabled the blacklisted words module.")
      );
    }
  }
}
