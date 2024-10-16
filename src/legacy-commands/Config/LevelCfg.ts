import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { CustomEmojis } from "../../Constants";
import { collections } from "../../core/database/DBClient";
import { GuildTextableChannel, Role } from "eris";

class LevelCfg extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "levelcfg",
      description: `**Docs:** [here](https://docs.proton-bot.net/features/leveling)\nConfigure levelling system, add role rewards, change level up messages etc...`,
      usage: "<command>",
      category: "config",
      commands: [
        {
          name: "enable",
          desc: "Enable the levelling system.",
          usage: "",
        },
        {
          name: "disable",
          desc: "Disable the levelling system.",
          usage: "",
        },
        {
          name: "panel",
          desc: "View the levelling config.",
          usage: "",
        },
        {
          name: "xprate",
          desc: "Config the xp rate.",
          usage: "<integer>",
        },
        {
          name: "channel",
          desc: "Set a specific channel to send level-up messages to.",
          usage: "<channel|disable>",
        },
        {
          name: "silent",
          desc: "Disable level-up messages, users will still gain xp and level up though.",
          usage: "<true|false>",
        },
        {
          name: "addreward",
          desc: "Add a role reward to be rewarded at a specific level.",
          usage: "<role>",
        },
        {
          name: "removereward",
          desc: "Add a role reward to be rewarded at a specific level.",
          usage: "<role>",
        },
        {
          name: "message",
          desc: "Set a custom level-up message.",
          usage: "<text>",
        },
        {
          name: "stack",
          desc: "Whether to stack role rewards together.",
          usage: "<true|false>",
        },
        {
          name: "banrole",
          desc: "Ban a role, members with a specific role will not gain any xp.",
          usage: "<role>",
        },
        {
          name: "unbanrole",
          desc: "Un-ban a previously banned role.",
          usage: "<role>",
        },
        {
          name: "banchannel",
          desc: "Ban a channel, any messages in that channel will be ignored by levels.",
          usage: "<channel>",
        },
        {
          name: "unbanchannel",
          desc: "Un-ban a previously banned channel.",
          usage: "<channel>",
        },
        {
          name: "tags",
          desc: "View level up message tags",
          usage: "",
        },
      ],
      cooldown: 3000,
      aliases: ["level-cfg", "levelconfig"],
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async enable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "levels.enabled": true } }
    );
    this.successMessage(message, "Enabled the levelling system.");
  }
  async disable({ message }: ExecuteArgs) {
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "levels.enabled": false } }
    );
    this.successMessage(message, "Disabled the levelling system.");
  }
  async channel({ message, args }: ExecuteArgs) {
    if (args[0] === "disable") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $unset: { "levels.level_up_channel": "" } }
      );
      this.successMessage(
        message,
        `I will no longer send level-up messages to a specific channel.`
      );
    } else {
      const channel = this.parseChannel(args[0], message.channel.guild);
      if (!channel) {
        return this.errorMessage(message, "Specify a valid channel for level-up messages.");
      }
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "levels.level_up_channel": channel.id } }
      );
      this.successMessage(message, `I will now send level-up messages to: ${channel.mention}`);
    }
  }
  async silent({ message, args }: ExecuteArgs) {
    if (args[0] === "true") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "levels.silent": true } }
      );
      this.successMessage(message, `I will no longer send any level up messages.`);
    } else if (args[0] === "false") {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $set: { "levels.silent": false } }
      );
      this.successMessage(message, `I will now send level-up messages.`);
    } else {
      return this.errorMessage(message, `Use a valid option: \`true\` or \`false\``);
    }
  }
  async addreward({ message, args, config }: ExecuteArgs) {
    const level = parseInt(args[0]);
    if (isNaN(level)) {
      return this.errorMessage(message, "Level needs to be a number!");
    }
    if (level < 1) {
      return this.errorMessage(message, "Level needs to be above 0.");
    }
    if (level > 1000) {
      return this.errorMessage(message, "Level can't be above 1000.");
    }
    const role = this.parseRole(args.slice(1).join(" "), message.channel.guild);
    if (!role) {
      return this.errorMessage(
        message,
        `You need to use a role ID or role name or mention a role to reward at level **${level}**.`
      );
    }
    const existingReward = config.levels?.rewards?.find((x) => x.level === level);
    if (existingReward) {
      // there is already a reward on that level
      await collections.guildconfigs.updateOne(
        { _id: message.guildID, "levels.rewards.level": level },
        { $set: { "levels.rewards.$.role_id": role.id } }
      );
      const oldRole = message.channel.guild.roles.get(existingReward.role_id);
      const oldRoleName = oldRole?.name || "Unkown role";
      this.successMessage(
        message,
        [
          `I will give users ${role.name} role when they reach level **${level}**!`,
          `Note, I have replaced the previous reward on this level (${oldRoleName})`,
        ].join("\n")
      );
    } else {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        { $push: { "levels.rewards": { level: level, role_id: role.id } } }
      );
      this.successMessage(
        message,
        `I will give users ${role.name} role when they reach level **${level}**!`
      );
    }
  }
  async removereward({ message, args }: ExecuteArgs) {
    const level = parseInt(args[0]);
    if (isNaN(level)) {
      return this.errorMessage(message, "Level needs to be a number!");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { "levels.rewards": { level } } }
    );
    this.successMessage(message, `Remove the reward at level ${level}.`);
  }
  async message({ message, args }: ExecuteArgs) {
    const content = args.join(" ");
    if (!content) {
      return this.errorMessage(message, `Specify a level-up message.`);
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "levels.level_up_message": content } }
    );
    this.successMessage(message, `Updated the level up message.`);
  }
  async stack({ message, args }: ExecuteArgs) {
    const bool = args[0]?.toLowerCase() === "true";
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "levels.stack": bool } }
    );
    this.successMessage(
      message,
      `${bool ? "Enabled rewads stacking" : "Disabled rewards stacking"}.`
    );
  }
  async xprate({ message, args }: ExecuteArgs) {
    const rate = parseFloat(args[0]);
    if (isNaN(rate)) {
      return this.errorMessage(message, "Xp-rate needs to be a number.");
    }
    if (rate < 0.25) {
      return this.errorMessage(message, "Xp-rate can't be below 0.25!");
    }
    if (rate > 3) {
      return this.errorMessage(message, "Xp-rate can't be above 3.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $set: { "levels.xp_rate": rate } }
    );
    this.successMessage(message, `Xp-rate has been set to ${rate}.`);
  }
  async banrole({ message, args }: ExecuteArgs) {
    const role = this.parseRole(args.join(" "), message.channel.guild);
    if (!role) {
      return this.errorMessage(
        message,
        "You need to use a role ID or role name or mention a role to ban."
      );
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $addToSet: { "levels.ignored_roles": role.id } }
    );
    this.successMessage(message, `Banned ${role.name} role from gaining any xp.`);
  }
  async unbanrole({ message, args }: ExecuteArgs) {
    const role = this.parseRole(args.join(" "), message.channel.guild);
    if (!role) {
      return this.errorMessage(
        message,
        "You need to use a role ID or role name or mention a role to un-ban."
      );
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { "levels.ignored_roles": role.id } }
    );
    this.successMessage(message, `Un-banned ${role.name} role from gaining any xp.`);
  }
  async banchannel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Mention a channel to ban from gaining xp in.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $addToSet: { "levels.ignored_channels": channel.id } }
    );
    this.successMessage(
      message,
      `Banned ${channel.mention}, any messages sent in that channel will be ignored by the levelling system.`
    );
  }
  async unbanchannel({ message, args }: ExecuteArgs) {
    const channel = this.parseChannel(args.join(" "), message.channel.guild);
    if (!channel) {
      return this.errorMessage(message, "Mention a channel to ban from gaining xp in.");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      { $pull: { "levels.ignored_channels": channel.id } }
    );
    this.successMessage(
      message,
      `Un-banned ${channel.mention}, i will no longer ignore messages in it.`
    );
  }
  async panel({ message, config, prefix }: ExecuteArgs) {
    const { guild } = message.channel;
    const lvlupMsg = (
      config.levels?.level_up_message ??
      "**{user:username}#{user:discriminator}** you have reached level **{level}**!"
    ).slice(0, 200);

    const yesNoWithEmojis = (bool: boolean, extra?: string) => {
      let str = "";
      if (message.channel.permissionsOf(this.client.user.id).has("useExternalEmojis")) {
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
        yesNoWithEmojis(config.levels !== undefined && config.levels.enabled === true)
      )
      .field("Level rewards:", `See using: \`${prefix}rewards\``, true)
      .field("Level up message:", lvlupMsg, true)
      .field("Multiply XP by:", String(config.levels?.xp_rate || 1), true)
      .color("theme");
    if (
      config.levels &&
      config.levels.level_up_channel &&
      guild.channels.has(config.levels.level_up_channel)
    ) {
      builder.field("Level up channel:", `<#${config.levels.level_up_channel}>`, true);
    } else {
      builder.field("Level up channel:", `None, send level-up messages anywhere.`, true);
    }
    if (config.levels && config.levels.silent) {
      builder.field("Silent:", yesNoWithEmojis(true, " (don't send any level-up messages)"), true);
    } else {
      builder.field("Silent:", yesNoWithEmojis(false, " (send level-up messages)"), true);
    }
    if (config.levels && config.levels.stack) {
      builder.field("Stack rewards:", yesNoWithEmojis(true), true);
    } else {
      builder.field("Stack rewards:", yesNoWithEmojis(false), true);
    }
    if (config.levels && config.levels.ignored_roles && config.levels.ignored_roles.length) {
      const roleList = config.levels.ignored_roles
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
    if (config.levels && config.levels.ignored_channels && config.levels.ignored_channels.length) {
      const channelList = config.levels.ignored_channels
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
    message.channel.createMessage({ embeds: [builder.build()] });
  }
  tags({ message }: ExecuteArgs) {
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
    message.channel.createMessage(str);
  }
}
export default LevelCfg;
