import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { ChannelRestrictionsModeTypes } from "../../Constants";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { collections } from "../../core/database/DBClient";

class CommandChannel extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "command-channel",
      description: "Setup channels where commands can be used.",
      usage: "",
      category: "config",
      commands: [
        {
          name: "add",
          desc: "Add a blacklist/whitelist channel.",
          usage: "<channel>",
        },
        {
          name: "remove",
          desc: "Remove a blacklisted/whitelisted channel.",
          usage: "<channel>",
        },
        {
          name: "info",
          desc: "View information about current mode and channels affected.",
          usage: "",
        },
        {
          name: "mode",
          desc: "Whitelist - will only work in specific channels\nBlacklist - will work in any non-blacklisted channel.",
          usage: "<whitelist|blacklist>",
        },
      ],
      aliases: [],
      cooldown: 4000,
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async add({ message, args, config }: ExecuteArgs) {
    const channel = this.parseChannel(args[0], message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, `Specify a valid channel.`);
    }
    const mode = config?.chRestrictions?.mode || ChannelRestrictionsModeTypes.BLACKLIST;
    await collections.guildconfigs.updateOne(
      {
        _id: message.guildID,
      },
      {
        $addToSet: { "chRestrictions.channels": channel.id },
        $set: { "chRestrictions.mode": mode },
      }
    );
    this.successMessage(message, `Added ${channel.mention} to whitelist/blacklist`);
  }
  async remove({ message, args, config }: ExecuteArgs) {
    const channel = this.parseChannel(args[0], message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, `Specify a valid channel.`);
    }
    const mode = config?.chRestrictions?.mode || ChannelRestrictionsModeTypes.BLACKLIST;
    await collections.guildconfigs.updateOne(
      {
        _id: message.guildID,
      },
      {
        $pull: { "chRestrictions.channels": channel.id },
        $set: { "chRestrictions.mode": mode },
      }
    );
    this.successMessage(message, `Removed ${channel.mention} from whitelist/blacklist`);
  }
  async info({ message, config }: ExecuteArgs) {
    let mode = "blacklist";
    if (config?.chRestrictions?.mode === ChannelRestrictionsModeTypes.WHITELIST) {
      mode = "whitelist";
    }
    const infoEmbed = new EmbedBuilder();
    infoEmbed.field("Mode", `${mode}`);
    infoEmbed.field(
      "Channels",
      `${(config.chRestrictions?.channels || []).map((x) => `<#${x}>`).join(", ") || "None"}`
    );
    infoEmbed.color("theme");
    message.channel.createMessage({ embeds: [infoEmbed.build()] });
  }
  async mode({ message, args, prefix }: ExecuteArgs) {
    const lower = args[0]?.toLowerCase();
    if (lower === "whitelist") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "chRestrictions.mode": ChannelRestrictionsModeTypes.WHITELIST,
          },
        }
      );
      this.successMessage(message, "Updated mode to: `whitelist`.");
    } else if (lower === "blacklist") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $set: {
            "chRestrictions.mode": ChannelRestrictionsModeTypes.BLACKLIST,
          },
        }
      );
      this.successMessage(message, "Updated mode to: `blacklist`.");
    } else {
      this.errorMessage(
        message,
        `Use either \`whitelist\` or \`blacklist\`, for more info: \`${prefix}help ${this.name}\``
      );
    }
  }
}
export default CommandChannel;
