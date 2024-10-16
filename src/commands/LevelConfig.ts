import { ProtonClient } from "../core/client/ProtonClient";
import {
  CommandInteraction,
  GuildTextableChannel,
  Constants,
  InteractionDataOptionsSubCommand as SubCommand,
  InteractionDataOptionsSubCommandGroup as SubCommandGroup,
  InteractionDataOptionsBoolean as OptionBoolean,
  InteractionDataOptionsNumber as OptionNumber,
  InteractionDataOptionsChannel as OptionChannel,
  InteractionDataOptionsInteger as OptionInteger,
  InteractionDataOptionsRole as OptionRole,
  InteractionDataOptionsString as OptionString,
  AutocompleteInteraction,
  Guild,
  ModalSubmitInteraction,
  Role,
} from "eris";
import { collections } from "../core/database/DBClient";
import { LevelReward } from "../core/database/models/GuildConfig";
import Command from "../core/structs/ClientCommand";
import { CustomEmojis } from "../Constants";
import { EmbedBuilder } from "../utils/EmbedBuilder";

const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class LevelConfig extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "level-config";
  description = "Configure th leveling system for this server";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "toggle",
      description: "Toggle whether the leveling system is enabled.",
      options: [
        {
          type: OptionType.BOOLEAN,
          name: "value",
          description: "Whether to enable or disable the levelign system.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "xp-multiplier",
      description: "Configure the xp multiplier.",
      options: [
        {
          type: OptionType.NUMBER,
          name: "multiplier",
          description: "The value to multiply gained xp by.",
          required: true,
          min_value: 0.25,
          max_value: 3,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "level-channel",
      description: "Set a channel to send level-up messages to.",
      options: [
        {
          type: OptionType.CHANNEL,
          name: "target",
          description: "The channel to send level-up messages to.",
          required: true,
          channel_types: [
            Constants.ChannelTypes.GUILD_TEXT,
            Constants.ChannelTypes.GUILD_NEWS,
            Constants.ChannelTypes.GUILD_NEWS_THREAD,
            Constants.ChannelTypes.GUILD_PUBLIC_THREAD,
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "toggle-silent",
      description: "Toggle whether to send level-up messages.",
      options: [
        {
          type: OptionType.BOOLEAN,
          name: "value",
          description: "Whether to enable silent mode or not.",
          required: true,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "rewards",
      description: "Manage role rewards for in this server.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "add",
          description: "Add a new role reward.",
          options: [
            {
              type: OptionType.INTEGER,
              name: "level",
              description: "The level required to get this reward.",
              required: true,
              min_value: 1,
              max_value: 100,
            },
            {
              type: OptionType.ROLE,
              name: "role",
              description: "The role to give when a user reaches a level.",
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "remove",
          description: "Remove a previously created reward.",
          options: [
            {
              type: OptionType.STRING,
              name: "level",
              description: "The level required to get this reward.",
              required: true,
              autocomplete: true,
            },
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "message",
      description: "Set a level-up message",
      options: [],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "toggle-stack",
      description:
        "Toggle whether to stack user roles together or remove previous rewards once a new one is reached.",
      options: [
        {
          type: OptionType.BOOLEAN,
          name: "value",
          description: "Whether to enable role stack or not.",
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "role",
      description: "Ban or un-ban roles from getting xp.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "ban",
          description: "Ban a role from gaining any xp.",
          options: [
            {
              type: OptionType.ROLE,
              name: "target",
              description: "The role to ban.",
              required: true,
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "unban",
          description: "Un-ban a previously banned role/allow it to gain xp.",
          options: [
            {
              type: OptionType.ROLE,
              name: "target",
              description: "The role to un-ban.",
              required: true,
            },
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND_GROUP,
      name: "channel",
      description: "Ban or un-ban channels from getting xp.",
      options: [
        {
          type: OptionType.SUB_COMMAND,
          name: "ban",
          description: "Ban a channel from gaining any xp.",
          options: [
            {
              type: OptionType.CHANNEL,
              name: "target",
              description: "The channel to ban.",
              required: true,
              channel_types: [
                Constants.ChannelTypes.GUILD_TEXT,
                Constants.ChannelTypes.GUILD_NEWS,
                Constants.ChannelTypes.GUILD_NEWS_THREAD,
                Constants.ChannelTypes.GUILD_PUBLIC_THREAD,
              ],
            },
          ],
        },
        {
          type: OptionType.SUB_COMMAND,
          name: "unban",
          description: "Un-ban a previously banned channel/allow it to gain xp.",
          options: [
            {
              type: OptionType.CHANNEL,
              name: "target",
              description: "The channel to un-ban.",
              required: true,
              channel_types: [
                Constants.ChannelTypes.GUILD_TEXT,
                Constants.ChannelTypes.GUILD_NEWS,
                Constants.ChannelTypes.GUILD_NEWS_THREAD,
                Constants.ChannelTypes.GUILD_PUBLIC_THREAD,
              ],
            },
          ],
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "panel",
      description: "View the server leveling guildConfig.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "tags",
      description: "See the available tags for ProtonScript v0. (Deprecated)",
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

    const guild = interaction.channel.guild;
    if (!guild) return;

    const subCommand = interaction.data.options[0] as SubCommand | SubCommandGroup;
    if (!subCommand) {
      return;
    }

    if (subCommand.name === "toggle") {
      return await this.toggleStatus(interaction, subCommand.options as OptionBoolean[]);
    } else if (subCommand.name === "xp-multiplier") {
      return await this.xpMultiplier(interaction, subCommand.options as OptionNumber[]);
    } else if (subCommand.name === "level-channel") {
      return await this.levelChannel(interaction, subCommand.options as OptionChannel[]);
    } else if (subCommand.name === "toggle-silent") {
      return await this.toggleSilent(interaction, subCommand.options as OptionBoolean[]);
    } else if (subCommand.name === "rewards") {
      return await this.rewards(interaction, subCommand as SubCommandGroup);
    } else if (subCommand.name === "message") {
      return await this.message(interaction);
    } else if (subCommand.name === "role") {
      return await this.role(interaction, subCommand.options as SubCommand[]);
    } else if (subCommand.name === "channel") {
      return await this.channel(interaction, subCommand.options as SubCommand[]);
    } else if (subCommand.name === "panel") {
      return await this.panel(interaction);
    } else if (subCommand.name === "tags") {
      return await this.tags(interaction);
    }
  }

  async toggleStatus(
    interaction: CommandInteraction<GuildTextableChannel>,
    options: OptionBoolean[]
  ) {
    const enabled = options[0].value;
    await collections.guildconfigs.updateOne(
      { _id: interaction.guildID },
      { $set: { "levels.enabled": enabled } },
      { upsert: true }
    );
    return interaction.createMessage(
      this.successMessage(
        interaction.channel,
        `${enabled ? "Enabled" : "Disabled"} the leveling system.`
      )
    );
  }

  async xpMultiplier(
    interaction: CommandInteraction<GuildTextableChannel>,
    options: OptionNumber[]
  ) {
    const multiplyBy = options[0].value;
    await collections.guildconfigs.updateOne(
      { _id: interaction.guildID },
      { $set: { "levels.xp_rate": multiplyBy } },
      { upsert: true }
    );
    return interaction.createMessage(
      this.successMessage(interaction.channel, `Xp multiplier set to \`${multiplyBy}\``)
    );
  }

  async levelChannel(
    interaction: CommandInteraction<GuildTextableChannel>,
    options: OptionChannel[]
  ) {
    const channelID = options[0].value;
    await collections.guildconfigs.updateOne(
      {
        _id: interaction.guildID,
      },
      {
        $set: {
          "levels.level_up_channel": channelID,
        },
      },
      { upsert: true }
    );
    return interaction.createMessage(
      this.successMessage(interaction.channel, `Level up messages will be sent to: <#${channelID}>`)
    );
  }

  async toggleSilent(
    interaction: CommandInteraction<GuildTextableChannel>,
    options: OptionBoolean[]
  ) {
    const enabled = options[0].value;
    await collections.guildconfigs.updateOne(
      { _id: interaction.guildID },
      { $set: { "levels.silent": enabled } },
      { upsert: true }
    );
    return interaction.createMessage(
      this.successMessage(
        interaction.channel,
        `${enabled ? "Enabled" : "Disabled"} the leveling system.`
      )
    );
  }

  async rewards(interaction: CommandInteraction<GuildTextableChannel>, options: SubCommandGroup) {
    const subCommand = options.options[0] as SubCommand;
    if (!subCommand.options) {
      return;
    }

    const guildConfig = await this.client.getGuildConfig(interaction.guildID as string);
    if (!guildConfig) {
      return;
    }

    if (subCommand.name === "add") {
      const level = (subCommand.options[0] as OptionInteger).value;
      const roleID = (subCommand.options[1] as OptionRole).value;
      const resolvedRole = interaction.data.resolved?.roles?.get(roleID);
      if (!resolvedRole) {
        return;
      }

      const existingReward = guildConfig.levels?.rewards?.find((x) => x.level === level);
      if (existingReward) {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID, "levels.rewards.level": level },
          {
            $set: {
              "levels.rewards.$.role_id": roleID,
            },
          },
          { upsert: true }
        );
        const oldRole = interaction.channel.guild.roles.get(existingReward.role_id);
        if (oldRole) {
          return interaction.createMessage(
            this.successMessage(
              interaction.channel,
              `Users will get the \`${resolvedRole.name}\` role upon reaching level ${level}. **Note:** overwritten the old role reward: ${oldRole.name}`
            )
          );
        } else {
          return interaction.createMessage(
            this.successMessage(
              interaction.channel,
              `Users will get the \`${resolvedRole.name}\` role upon reaching level ${level}.`
            )
          );
        }
      } else {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          {
            $push: {
              "levels.rewards": { level: level, role_id: roleID },
            },
          },
          { upsert: true }
        );
        return interaction.createMessage(
          this.successMessage(
            interaction.channel,
            `Users will get the \`${resolvedRole.name}\` role upon reaching level ${level}.`
          )
        );
      }
    } else if (subCommand.name === "remove") {
      const level = Number((subCommand.options[0] as OptionString).value);
      const existingReward = guildConfig.levels?.rewards?.find((x) => x.level === level);
      const oldRole = existingReward
        ? interaction.channel.guild.roles.get(existingReward.role_id)
        : undefined;
      if (existingReward && oldRole) {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $pull: { "levels.rewards": { level } } },
          { upsert: true }
        );
        return interaction.createMessage(
          this.successMessage(
            interaction.channel,
            `Removed reward from level **${level}**. The role awarded at that level was: ${oldRole.name} (\`${oldRole.id}\`)`
          )
        );
      } else {
        await collections.guildconfigs.updateOne(
          { _id: interaction.guildID },
          { $pull: { "levels.rewards": { level } } },
          { upsert: true }
        );
        return interaction.createMessage(
          this.successMessage(interaction.channel, `Removed reward from level **${level}**.`)
        );
      }
    }
  }

  async message(interaction: CommandInteraction<GuildTextableChannel>) {
    const guildConfig = await this.client.getGuildConfig(interaction.guildID as string);
    if (!guildConfig) {
      return;
    }
    return await interaction.createModal({
      title: "Level up Message",
      custom_id: "level_msg",
      components: [
        {
          type: Constants.ComponentTypes.ACTION_ROW,
          components: [
            {
              type: Constants.ComponentTypes.TEXT_INPUT,
              style: Constants.TextInputStyles.PARAGRAPH,
              custom_id: "level_msg_content",
              label: "Content",
              value:
                (guildConfig.levels && guildConfig.levels.level_up_message) ||
                "**{user:username}#{user:discriminator}** you have reached level **{level}**!",
              min_length: 1,
              max_length: 1000,
              required: true,
            },
          ],
        },
      ],
    });
  }

  async autoCompleteHandler(interaction: AutocompleteInteraction<GuildTextableChannel>) {
    if (!interaction.guildID) {
      return;
    }

    if (!interaction.channel.guild) {
      return;
    }

    const subCommandGroup = interaction.data.options[0];
    if (!subCommandGroup || subCommandGroup.type !== OptionType.SUB_COMMAND_GROUP) {
      return;
    }

    const subCommand = subCommandGroup.options[0];
    if (
      subCommand.type === OptionType.SUB_COMMAND &&
      subCommand.options &&
      subCommand.name === "remove"
    ) {
      const guildConfig = await this.client.getGuildConfig(interaction.guildID);
      if (!guildConfig) {
        return;
      }

      const level = subCommand.options[0];
      const rewards = guildConfig.levels?.rewards || [];
      return interaction.result(
        this.generateResults(String(level.value), rewards, interaction.channel.guild)
      );
    }
  }

  async levelMsgModal(interaction: ModalSubmitInteraction<GuildTextableChannel>) {
    if (!interaction.guildID || !interaction.member) {
      return;
    }
    if (!interaction.channel.guild.permissionsOf(interaction.member).has("manageGuild")) {
      return interaction.createMessage(
        this.errorMessage(interaction.channel, "You don't have permissions in this **guild**.")
      );
    }
    const actionRow1 = interaction.data.components[0];
    if (!actionRow1) {
      return;
    }

    const message = actionRow1.components[0];
    await collections.guildconfigs.updateOne(
      { _id: interaction.guildID },
      { $set: { "levels.level_up_message": message.value } },
      { upsert: true }
    );
    return interaction.createMessage(
      this.successMessage(interaction.channel, `Updated the level-up message.`)
    );
  }

  async role(interaction: CommandInteraction<GuildTextableChannel>, options: SubCommand[]) {
    const subCommand = options[0];
    if (subCommand.name === "ban" && subCommand.options) {
      const role = subCommand.options[0] as OptionRole;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $addToSet: { "levels.ignored_roles": role.value } },
        { upsert: true }
      );
      const resolvedRole = interaction.data.resolved?.roles?.get(role.value);
      return interaction.createMessage(
        this.successMessage(
          interaction.channel,
          `Banned the role: ${resolvedRole ? `@${resolvedRole.name}` : role.value}`
        )
      );
    } else if (subCommand.name === "unban" && subCommand.options) {
      const role = subCommand.options[0] as OptionRole;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $pull: { "levels.ignored_roles": role.value } },
        { upsert: true }
      );
      const resolvedRole = interaction.data.resolved?.roles?.get(role.value);
      return interaction.createMessage(
        this.successMessage(
          interaction.channel,
          `Un-banned the role: ${resolvedRole ? `@${resolvedRole.name}` : role.value}`
        )
      );
    }
  }

  async channel(interaction: CommandInteraction<GuildTextableChannel>, options: SubCommand[]) {
    const subCommand = options[0];
    if (subCommand.name === "ban" && subCommand.options) {
      const channel = subCommand.options[0] as OptionChannel;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $addToSet: { "levels.ignored_channels": channel.value } },
        { upsert: true }
      );
      return interaction.createMessage(
        this.successMessage(interaction.channel, `Banned the channel: <#${channel.value}>`)
      );
    } else if (subCommand.name === "unban" && subCommand.options) {
      const channel = subCommand.options[0] as OptionChannel;
      await collections.guildconfigs.updateOne(
        { _id: interaction.guildID },
        { $pull: { "levels.ignored_channels": channel.value } },
        { upsert: true }
      );
      return interaction.createMessage(
        this.successMessage(interaction.channel, `Un-banned the channel: <#${channel.value}>`)
      );
    }
  }

  async panel(interaction: CommandInteraction<GuildTextableChannel>) {
    const guildConfig = await this.client.getGuildConfig(interaction.guildID as string);
    if (!guildConfig) {
      return;
    }

    const { guild } = interaction.channel;
    const lvlupMsg = (
      guildConfig.levels?.level_up_message ??
      "**{user:username}#{user:discriminator}** you have reached level **{level}**!"
    ).slice(0, 200);

    const yesNoWithEmojis = (bool: boolean, extra?: string) => {
      let str = "";
      if (interaction.channel.permissionsOf(this.client.user.id).has("useExternalEmojis")) {
        str += bool ? `${CustomEmojis.GreenTick} ` : `${CustomEmojis.RedTick} `;
      }
      str += bool ? "True" : "False";
      if (extra) {
        str += extra;
      }
      return str;
    };
    const builder = new EmbedBuilder()
      .title(`Levelling config in: ${guild.name}`)
      .field(
        "Enabled:",
        yesNoWithEmojis(guildConfig.levels !== undefined && guildConfig.levels.enabled === true),
        true
      )
      .field(
        "Level rewards:",
        `See using: \`${(guildConfig.prefixes && guildConfig.prefixes[0]) || "-"}rewards\``,
        true
      )
      .field("Level up message:", lvlupMsg, true)
      .field("Multiply XP by:", String(guildConfig.levels?.xp_rate || 1), true)
      .color("theme");
    if (
      guildConfig.levels &&
      guildConfig.levels.level_up_channel &&
      guild.channels.has(guildConfig.levels.level_up_channel)
    ) {
      builder.field("Level up channel:", `<#${guildConfig.levels.level_up_channel}>`, true);
    } else {
      builder.field("Level up channel:", `None, send level-up messages anywhere.`, true);
    }
    if (guildConfig.levels && guildConfig.levels.silent) {
      builder.field("Silent:", yesNoWithEmojis(true, " (don't send any level-up messages)"), true);
    } else {
      builder.field("Silent:", yesNoWithEmojis(false, " (send level-up messages)"), true);
    }
    if (guildConfig.levels && guildConfig.levels.stack) {
      builder.field("Stack rewards:", yesNoWithEmojis(true), true);
    } else {
      builder.field("Stack rewards:", yesNoWithEmojis(false), true);
    }
    if (
      guildConfig.levels &&
      guildConfig.levels.ignored_roles &&
      guildConfig.levels.ignored_roles.length
    ) {
      const roleList = guildConfig.levels.ignored_roles
        .filter((r) => guild.roles.has(r))
        .slice(0, 30)
        .map((r) => `<@&${(guild.roles.get(r) as Role).id}>`)
        .join(", ");
      if (roleList.length > 0) {
        builder.field("Ignored roles:", roleList, true);
      } else {
        builder.field("Ignored roles:", `none`, true);
      }
    } else {
      builder.field("Ignored roles:", `none`, true);
    }
    if (
      guildConfig.levels &&
      guildConfig.levels.ignored_channels &&
      guildConfig.levels.ignored_channels.length
    ) {
      const channelList = guildConfig.levels.ignored_channels
        .filter((r) => guild.channels.has(r))
        .slice(0, 30)
        .map((r) => `<#${(guild.channels.get(r) as GuildTextableChannel).id}>`)
        .join(", ");
      if (channelList.length > 0) {
        builder.field("Ignored channels:", channelList, true);
      } else {
        builder.field("Ignored channels:", `none`, true);
      }
    } else {
      builder.field("Ignored channels:", `none`, true);
    }
    return interaction.createMessage({ embeds: [builder.build()] });
  }

  tags(interaction: CommandInteraction<GuildTextableChannel>) {
    const userTags = [
      "{user:mention} Mention the user.",
      "{user:id} User's id that leveled up.",
      "{user:username} User's username.",
      "{user:discriminator} User's discriminator",
      "{user:avatarURL} User's avatar url",
    ].join(`\n`);
    const serverTags = [
      "{server:id} The server's id.",
      "{server:name} The server's name.",
      "{server:rtcRegion} The server's rtcRegion.",
      "{server:iconURL} The server's icon url.",
      "{server:ownerID} The server's owner user ID.",
      "{server:memberCount} The server's member count/",
    ].join("\n");
    const rewardTags = [
      "{reward:id} The id of the rewarded role, can be null if no reward is given.",
      "{reward:name} The name of the rewarded role, can be null if no reward is given.",
      "{reward:mention} The mention of the rewarded role, can be null if no reward is given.",
    ].join("\n");
    const others = ["{level} The user's new level", "{oldLevel} The user's old level."].join("\n");
    let str = "";
    str += `**Server Tags:** \`\`\`${serverTags}\`\`\``;
    str += `\n**User Tags:** \`\`\`${userTags}\`\`\``;
    str += `\n**Reward Tags:** \`\`\`${rewardTags}\`\`\``;
    str += `\n**Others:** \`\`\`${others}\`\`\``;
    return interaction.createMessage(str);
  }

  generateResults(query: string, rewards: LevelReward[], guild: Guild) {
    if (query.length > 0) {
      rewards = rewards.filter((r) => query.includes(String(r.level)));
    }
    const results = [];
    for (const reward of rewards) {
      const guildRole = guild.roles.get(reward.role_id);
      if (guildRole) {
        results.push({
          name: `Level: ${reward.level}, @${guildRole.name}`,
          value: String(reward.level),
        });
      } else {
        results.push({
          name: `Level: ${reward.level}, Unknown role`,
          value: String(reward.level),
        });
      }
      if (results.length === 25) {
        break;
      }
    }
    return results;
  }
}
