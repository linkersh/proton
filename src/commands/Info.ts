import { ProtonClient } from "../core/client/ProtonClient";
import { CommandInteraction, GuildTextableChannel, Constants } from "eris";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { FormattedPerms } from "../Constants";
import { getTag } from "../utils/Util";
import Command from "../core/structs/ClientCommand";
const { ApplicationCommandOptionTypes: OptionType } = Constants;

export default class Info extends Command {
  constructor(client: ProtonClient) {
    super(client);
  }
  name = "info";
  description = "See information about a role, user, or this server.";
  type = Constants.ApplicationCommandTypes.CHAT_INPUT;
  options = [
    {
      type: OptionType.SUB_COMMAND,
      name: "server",
      description: "View information about this server.",
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "user",
      description: "View information about a specific user.",
      options: [
        {
          type: OptionType.USER,
          name: "target",
          description: "The user to view information of.",
          required: false,
        },
      ],
    },
    {
      type: OptionType.SUB_COMMAND,
      name: "role",
      description: "View information about a specific role in the server.",
      options: [
        {
          type: OptionType.ROLE,
          name: "target",
          description: "The role to view information of.",
          required: true,
        },
      ],
    },
  ];
  guildID = null;
  async handler(interaction: CommandInteraction<GuildTextableChannel>) {
    if (interaction.data.options === undefined) {
      return;
    }
    if (!interaction.guildID || !interaction.member) {
      return;
    }

    const guild = await this.client.getGuild(interaction.guildID);
    if (!guild) {
      return;
    }

    const subCommand = interaction.data.options[0];
    if (subCommand.type !== OptionType.SUB_COMMAND) return;

    if (subCommand.name === "role") {
      if (subCommand.options === undefined) return;
      const roleOpt = subCommand.options[0];
      if (!roleOpt || roleOpt.type !== OptionType.ROLE) return;

      const role =
        interaction.data.resolved &&
        interaction.data.resolved.roles &&
        interaction.data.resolved.roles.get(roleOpt.value);
      if (!role) return;

      const perms = [];
      for (const [key] of Object.entries(role.permissions.json)) {
        if (FormattedPerms[key.toString() as keyof typeof FormattedPerms] !== undefined) {
          perms.push(FormattedPerms[key.toString() as keyof typeof FormattedPerms]);
        }
      }
      const builder = new EmbedBuilder()
        .title(`Role: ${role.name}`)
        .field(`Created at`, `<t:${Math.floor(role.createdAt / 1000)}:F>`, false)
        .field("ID", role.id, true)
        .field("Color", `#${role.color.toString(16)}`, true)
        .field("Position", `${role.position}/${guild.roles.size}`, true)
        .field("Mention", `\`${role.mention}\``, true)
        .field("Hoisted", role.hoist ? "true" : "false", true)
        .field("Mentionable", role.mentionable ? "true" : "false", true)
        .field("Permissions", perms.join(", ") || "No permissions", false)
        .color(role.color ? `#${role.color.toString(16)}` : "theme");
      return interaction.createMessage({ embeds: [builder.build()] });
    } else if (subCommand.name === "server") {
      const textChannels = guild.channels.filter(
        (x) => x.type === Constants.ChannelTypes.GUILD_TEXT
      ).length;
      const voiceChannels = guild.channels.filter(
        (x) => x.type === Constants.ChannelTypes.GUILD_VOICE
      ).length;
      const roles = `${guild.roles
        .filter((x) => x.name !== "@everyone")
        .sort((a, b) => b.position - a.position)
        .map((x) => x.mention)
        .join(" ")}`;
      const memberList = [...guild.members.values()];
      let bots = 0;
      let members = 0;
      for (const member of memberList) {
        if (member.user.bot) {
          bots++;
        } else {
          members++;
        }
      }
      const botsFormat = bots.toLocaleString();
      const membersFormat = members.toLocaleString();
      const infoEmbed = new EmbedBuilder()
        .title(guild.name)
        .field("Created At", `<t:${Math.floor(guild.createdAt / 1000)}:F>`, true)
        .field("ID", guild.id, true)
        .field("Owner", `<@!${guild.ownerID}>`, true)
        .field(
          `Members (${guild.memberCount.toLocaleString()})`,
          `Humans: **${membersFormat}**, Bots: **${botsFormat}**`,
          true
        )
        .field("Channels", `Text: **${textChannels}**, Voice: **${voiceChannels}**`, true)
        .field(
          `Roles (${guild.roles.size})`,
          `${roles.length <= 1024 ? roles : "Too much to display!"}`,
          false
        )
        .color("theme")
        .thumbnail(guild.dynamicIconURL(undefined, 512) ?? "");
      const bannerURL = guild.dynamicBannerURL("png", 2048);
      if (bannerURL) {
        infoEmbed.image(bannerURL);
      }
      return interaction.createMessage({
        embeds: [infoEmbed.build()],
      });
    } else if (subCommand.name === "user") {
      if (subCommand.options === undefined) return;
      const userOpt = subCommand.options[0];
      if (!userOpt || userOpt.type !== OptionType.USER) return;

      const member =
        interaction.data.resolved &&
        interaction.data.resolved.members &&
        interaction.data.resolved.members.get(userOpt.value);
      const user =
        interaction.data.resolved &&
        interaction.data.resolved.users &&
        interaction.data.resolved.users.get(userOpt.value);
      const builder = new EmbedBuilder();
      if (user && member) {
        const adminPerms: (keyof typeof FormattedPerms)[] = [
          "kickMembers",
          "banMembers",
          "administrator",
          "manageChannels",
          "manageGuild",
          "viewAuditLog",
          "manageMessages",
          "mentionEveryone",
          "viewGuildInsights",
          "voiceMuteMembers",
          "voiceDeafenMembers",
          "voiceMoveMembers",
          "manageNicknames",
          "manageRoles",
          "manageWebhooks",
          "manageEmojisAndStickers",
        ];
        const permissions = [];
        for (const perm of adminPerms) {
          if (
            member.permissions.has(perm as keyof typeof Constants.Permissions) &&
            FormattedPerms[perm] !== undefined
          ) {
            permissions.push(FormattedPerms[perm]);
          }
        }
        const filteredRoles = member.roles.filter((role) => role !== guild.id);
        const roles = `${filteredRoles.map((x) => `<@&${x}>`).join(" ")}`;
        builder
          .color("theme")
          .author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256))
          .description(`${member.mention} \`(id: ${member.id})\``)
          .field("Created at", `<t:${Math.floor(member.user.createdAt / 1000)}:F>`)
          .field("Joined Server at", `<t:${Math.floor((member.joinedAt ?? 0) / 1000)}:F>`)
          .field(
            `Roles (${filteredRoles.length})`,
            (roles.length <= 1024 ? roles : "Too much to display!") || "None"
          )
          .field("Admin Perms", permissions.join(", ") || "None")
          .thumbnail(member.user.dynamicAvatarURL(undefined, 512));
      } else if (user) {
        builder
          .color("theme")
          .author(getTag(user), user.dynamicAvatarURL(undefined, 256))
          .description(`${user.mention} \`(id: ${user.id})\``)
          .field("Created at", `<t:${Math.floor(user.createdAt / 1000)}:F>`);
      } else return;
      return interaction.createMessage({ embeds: [builder.build()] });
    }
  }
}
