import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { CustomEmojis } from "../../Constants";
import { sensorWord } from "../../utils/Util";
import { collections } from "../../core/database/DBClient";
import { createActionButtons } from "../../utils/AutoModButtons";
import { BadWord } from "../../core/database/models/GuildConfig";

class Badwords extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "badwords",
      description: "Prevent members from sending blacklisted words and punish them if they do.",
      usage: "",
      commands: [
        {
          name: "add",
          desc: "Add a blacklisted word.",
          usage: "<word>",
          cooldown: 3000,
        },
        {
          name: "remove",
          desc: "Remove a blacklisted word.",
          usage: "<word>",
          cooldown: 3000,
        },
        {
          name: "actions",
          desc: "Specify specific actions to apply when a user uses a blacklisted word.",
          usage: "<automod_actions>",
          cooldown: 3000,
        },
        {
          name: "list",
          desc: "View all badwords.",
          usage: "",
          cooldown: 3000,
        },
        {
          name: "disable",
          desc: "Disable this automod module.",
          usage: "",
        },
      ],
      aliases: ["blacklistedwords", "blacklist", "blacklist-words"],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async add({ message, args, config, prefix }: ExecuteArgs) {
    const word = args[0];
    if (!word) {
      return this.errorMessage(message, `Specify a word to blacklist`);
    }
    if (word.length < 3) {
      return this.errorMessage(
        message,
        "A blacklisted word needs to be above or equal to 3 characters."
      );
    }
    if (word.length > 128) {
      return this.errorMessage(message, "Blacklisted words cannot be above 128 in length.");
    }
    if (config.automod && config.automod.badwordList && config.automod.badwordList.length >= 50) {
      return this.errorMessage(message, "You cannot add more than 50 blacklisted words.");
    }
    const flags = args[1];
    let score = -1;
    if (flags) {
      score = Number(flags);
      if (!Number.isInteger(score)) {
        return this.errorMessage(
          message,
          `Second argument (minimum match score) must be an integer. If you are trying to add a word with multiple spaces use ${prefix}badwords add "word here"`
        );
      }
      if (score < 30) {
        return this.errorMessage(message, "Minimum scoer must be at least 30.");
      }
    }

    const badword: BadWord = { text: word };
    if (score !== -1) {
      badword.match_score = score / 100;
    } else {
      badword.exact_match = true;
    }

    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $addToSet: { "automod.badwordList": badword } }
    );
    this.successMessage(message, `Blacklisted \`${sensorWord(word)}\` word.`);
  }
  async remove({ message, args }: ExecuteArgs) {
    const word = args.join(" ");
    if (!word) {
      return this.errorMessage(message, `Specify a word to blacklist`);
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { "automod.badwordList": { text: word } } }
    );
    this.successMessage(message, `\`${sensorWord(word)}\` word is no longer blacklisted.`);
  }
  async actions({ message }: ExecuteArgs) {
    createActionButtons(message, async ({ duration, actions, interaction }) => {
      const badwords = {
        actions: actions,
        duration: 0,
      };
      if (duration > 0) {
        badwords["duration"] = duration * 60000;
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "automod.badwords": badwords } }
      );
      interaction.editParent({
        content: `${CustomEmojis.GreenTick} Updated badwords automod module.`,
        components: [],
      });
    });
  }
  list({ message, config }: ExecuteArgs) {
    if (!config.automod?.badwordList?.length) {
      return this.errorMessage(message, "There aren't any blacklisted words.");
    }

    const words = config.automod.badwordList.map((x) => x.text);
    let currentString = `Blacklisted words in: ${message.channel.guild.name}:\n`;
    for (const word of words) {
      const stringToAdd = ` \`${word}\``;
      currentString += stringToAdd;
    }
    if (currentString.length > 2000) {
      return message.channel.createMessage("", {
        file: currentString,
        name: "badwords.txt",
      });
    } else {
      return message.channel.createMessage(currentString);
    }
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { "automod.badwords": "" } }
    );
    this.successMessage(message, "Disabled the badwords automod.");
  }
}
export default Badwords;
