import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants } from "eris";
import Command from "../core/structs/ClientCommand";
import { collections } from "../core/database/DBClient";
import { EmbedBuilder } from "../utils/EmbedBuilder";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Starboard extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "starboard";
  description = "Create starboard";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "starboard-channel",
      description: "Set the starboard channel.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "channel",
          description: "The channel to set as the starboard channel.",
          channel_types: [
            Constants.ChannelTypes.GUILD_TEXT,
            Constants.ChannelTypes.GUILD_NEWS,
            Constants.ChannelTypes.GUILD_NEWS_THREAD,
            Constants.ChannelTypes.GUILD_PUBLIC_THREAD,
          ],
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "min-stars",
      description:
        "Set the minimum amount of star reactions required to post the messge to the starboard channel.",
      options: [
        {
          type: OptionType.INTEGER,
          name: "stars",
          description: "Minimum star count",
          required: true,
          min_value: 2,
          max_value: 25,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "ignore",
      description: "Configure in which cases to ignore messages that reach the minimum star count.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "author",
          description: "Whether to ignore the reaction by the message author.",
          options: [
            {
              type: OptionType.BOOLEAN,
              name: "value",
              description: "True to ignore, False to count the reaction.",
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "bots",
          description: "Whether to ignore the reaction(s) by bot(s)",
          options: [
            {
              type: OptionType.BOOLEAN,
              name: "value",
              description: "True to ignore, False to count the reaction(s).",
              required: true,
            },
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "channel",
      description: "Ban and unban specific channels.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "ban",
          description: "Ignore all star reactions on messages in a specific channel.",
          options: [
            {
              type: OptionType.CHANNEL,
              name: "channel",
              description: "The channel to ban",
              channel_types: [Constants.ChannelTypes.GUILD_TEXT],
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "unban",
          description: "Un-ban a previously banned channel.",
          options: [
            {
              type: OptionType.CHANNEL,
              name: "channel",
              description: "The channel to un-ban",
              channel_types: [Constants.ChannelTypes.GUILD_TEXT],
              required: true,
            },
          ],
        },
      ],
    },
  ];
  guildID = null;
  defaultMemberPermissions = Constants.Permissions.manageGuild.toString();
  dmPermission = false;

  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) {
      return;
    }
    if (!interaction.guildID || !interaction.member) {
      return;
    }
    await interaction.acknowledge();

    const subCommandOrGroup = interaction.data.options && interaction.data.options[0];
    if (!subCommandOrGroup) return;
    if (
      subCommandOrGroup.type !== OptionType.SUB_COMMAND &&
      subCommandOrGroup.type !== OptionType.SUB_COMMAND_GROUP
    )
      return;
    if (!interaction.guildID || !interaction.member) {
      return interaction.createFollowup(
        this.errorMessage(interaction.channel, "This command can only be used in a server.")
      );
    }
    if (subCommandOrGroup.name === "starboard-channel") {
      const channelOpt = subCommandOrGroup.options && subCommandOrGroup.options[0];
      if (!channelOpt || channelOpt.type !== OptionType.CHANNEL) {
        return;
      }
      const channel =
        interaction.data.resolved &&
        interaction.data.resolved.channels &&
        interaction.data.resolved.channels.get(channelOpt.value);
      if (!channel) {
        return;
      }

      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $set: { "starboard.channel": channel.id } },
        { upsert: true }
      );
      return interaction.createFollowup(
        this.successMessage(interaction.channel, `Set starboard channel to: <#${channel.id}>.`)
      );
    } else if (subCommandOrGroup.name === "min-stars") {
      const starsOpt = subCommandOrGroup.options && subCommandOrGroup.options[0];
      if (!starsOpt || starsOpt.type !== OptionType.INTEGER) {
        return;
      }
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $set: { "starboard.minStars": starsOpt.value } },
        { upsert: true }
      );
      return interaction.createFollowup(
        this.successMessage(
          interaction.channel,
          `Minimum star (⭐) reactions required set to: **${starsOpt.value}**.`
        )
      );
    } else if (subCommandOrGroup.name === "ignore") {
      const subcommand = subCommandOrGroup.options && subCommandOrGroup.options[0];
      if (!subcommand || subcommand.type !== OptionType.SUB_COMMAND) {
        return;
      }
      if (subcommand.name === "author") {
        const valueOpt = subcommand.options && subcommand.options[0];
        if (!valueOpt || valueOpt.type !== OptionType.BOOLEAN) {
          return;
        }
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $set: { "starboard.ignoreSelf": valueOpt.value } },
          { upsert: true }
        );
        if (valueOpt.value === true) {
          return interaction.createFollowup(
            this.successMessage(
              interaction.channel,
              `Star (⭐) reactions on message(s) by their authors will be **ignored**.`
            )
          );
        } else {
          return interaction.createFollowup(
            this.successMessage(
              interaction.channel,
              `Star (⭐) reactions on message(s) by their authors will **no longer** be ignored.`
            )
          );
        }
      } else if (subcommand.name === "bots") {
        const valueOpt = subcommand.options && subcommand.options[0];
        if (!valueOpt || valueOpt.type !== OptionType.BOOLEAN) {
          return;
        }
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $set: { "starboard.ignoreBots": valueOpt.value } },
          { upsert: true }
        );
        if (valueOpt.value === true) {
          return interaction.createFollowup(
            this.successMessage(
              interaction.channel,
              `Star (⭐) reactions on message(s) by bots will be **ignored**.`
            )
          );
        } else {
          return interaction.createFollowup(
            this.successMessage(
              interaction.channel,
              `Star (⭐) reactions on message(s) by bots will **no longer** be ignored.`
            )
          );
        }
      }
    } else if (subCommandOrGroup.name === "channel") {
      const subcommand = subCommandOrGroup.options && subCommandOrGroup.options[0];
      if (!subcommand || subcommand.type !== OptionType.SUB_COMMAND) {
        return;
      }
      const channelOpt = subcommand.options && subcommand.options[0];
      if (!channelOpt || channelOpt.type !== OptionType.CHANNEL) {
        return;
      }
      const resolvedChannel =
        interaction.data.resolved &&
        interaction.data.resolved.channels &&
        interaction.data.resolved.channels.get(channelOpt.value);
      if (!resolvedChannel) {
        return interaction.createFollowup("Unresolved channel.");
      }
      if (subcommand.name === "ban") {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          {
            $addToSet: {
              "starboard.ignoredChannels": resolvedChannel.id,
            },
          },
          { upsert: true }
        );
        return interaction.createFollowup(
          this.successMessage(
            interaction.channel,
            `All star (⭐) reactions in: <#${resolvedChannel.id}> will be **ignored**.`
          )
        );
      } else if (subcommand.name === "unban") {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $pull: { "starboard.ignoredChannels": resolvedChannel.id } },
          { upsert: true }
        );
        return interaction.createFollowup(
          this.successMessage(
            interaction.channel,
            `All star (⭐) reactions in: <#${resolvedChannel.id}> will **no longer** be ignored.`
          )
        );
      }
    } else if (subCommandOrGroup.name === "panel") {
      const config = await this.client.getGuildConfig(interaction.guildID);
      if (!config?.starboard) {
        return interaction.createFollowup(
          this.errorMessage(interaction.channel, "Starboard is not configured.")
        );
      }
      const fStarboardChannel = config.starboard.channel
        ? `<#${config.starboard.channel}>`
        : "None";
      const fMinStars = config.starboard.minStars ? String(config.starboard.minStars) : "2";
      const fIgnoreBots = config.starboard.ignoreBots === true;
      const fIgnoreSelf = config.starboard.ignoreSelf === true;
      const fBannedChannels =
        config.starboard.ignoredChannels && config.starboard.ignoredChannels.length > 0
          ? `${config.starboard.ignoredChannels.map((x) => `<#${x}>`).join(", ")}`
          : "None";
      const builder = new EmbedBuilder();
      builder
        .title("Starboard panel")
        .color("theme")
        .field("Starboard Channel", fStarboardChannel, true)
        .field("Minimum Stars", fMinStars, true)
        .field("Ignore Bots", String(fIgnoreBots), true)
        .field("Ignore Message Author", String(fIgnoreSelf), true)
        .field("Banned Channenls", fBannedChannels, true);
      return interaction.createFollowup({ embeds: [builder.build()] });
    }
  }
}
