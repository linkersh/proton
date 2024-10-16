import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class Starboard extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "starboard",
      description:
        "**Docs:** [here](https://docs.proton-bot.net/features/starboard)\nIf a message gets a specific amount of reactions with ⭐ emoji, it will be posted to a specific channel. This command is to configure the starboard module.",
      usage: "<command>",
      commands: [
        {
          name: "channel",
          desc: "Set a starboard channel",
          usage: "<channel>",
        },
        {
          name: "stars",
          desc: "Set a minimum amount of required stars for a message to be posted in a starboard channel.",
          usage: "<number>",
        },
        {
          name: "ignorebots",
          desc: "Whether to include the count of reactions by bots in the star count.",
          usage: "<true|false>",
        },
        {
          name: "ignoreself",
          desc: "Whether to include the reaction by the message author in the star count.",
          usage: "<true|false>",
        },
        {
          name: "banchannel",
          desc: "Ban all starred messages from a specific channel(s).",
          usage: "<channel>",
        },
        {
          name: "unbanchannel",
          desc: "Un-ban a previously banned channel from starboard.",
          usage: "<channel>",
        },
        {
          name: "disable",
          desc: "Disable the starboard module.",
          usage: "",
        },
      ],
      aliases: [],
      category: "config",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async channel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Mention a valid channel to set as the starboard channel.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "starboard.channel": channel.id } }
    );
    this.successMessage(message, `Starboard channel set to: ${channel.mention}`);
  }
  async stars({ message, args }: ExecuteArgs) {
    const minStars = parseInt(args[0]);
    if (isNaN(minStars) || minStars < 2) {
      return this.errorMessage(message, "Star count needs to be a number above 1.");
    }
    if (minStars > 25) {
      return this.errorMessage(message, "Star count needs to be a number below or equal to 25.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "starboard.minStars": minStars } }
    );
    this.successMessage(message, `Minimum star count set to: ${minStars}`);
  }
  async ignorebots({ message, args }: ExecuteArgs) {
    const bool = args[0]?.toLowerCase() === "true";
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "starboard.ignoreBots": bool } }
    );
    this.successMessage(message, `Ignore bot reactions set to: \`${bool}\``);
  }
  async ignoreself({ message, args }: ExecuteArgs) {
    const bool = args[0]?.toLowerCase() === "true";
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "starboard.ignoreSelf": bool } }
    );
    this.successMessage(message, `Ignore self-reactions set to: \`${bool}\``);
  }
  async banchannel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Specify a channel to ban");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $addToSet: { "starboard.ignoredChannels": channel.id } }
    );
    this.successMessage(message, `Banned ${channel.mention} from starboard.`);
  }
  async unbanchannel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Specify a channel to ban");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { "starboard.ignoredChannels": channel.id } }
    );
    this.successMessage(message, `Un-banned ${channel.mention} from starboard.`);
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $unset: { starboard: "" } }
    );
    this.successMessage(message, `Disabled the starboard module.`);
  }
}
export default Starboard;
