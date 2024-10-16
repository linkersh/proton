import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder.js";
import { FormattedPerms } from "../../Constants.js";
import { getTag } from "../../utils/Util";
import { Constants } from "eris";

class Userinfo extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "userinfo",
      description: "View information about a user or a member.",
      usage: "[member|user_id]",
      aliases: ["i", "user", "ui"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    const builder = new EmbedBuilder();
    let member = await this.resolveMember(args.join(" "), message.channel.guild);
    if (/^[0-9]{16,19}$/.test(args[0]) && !member) {
      let user;
      try {
        user = await this.client.getRESTUser(args[0]);
      } catch {
        // eslint-disable-next-line
      }
      if (user) {
        builder.color("theme");
        builder.author(getTag(user), user.dynamicAvatarURL(undefined, 256));
        builder.description(`${user.mention} \`(id: ${user.id})\``);
        builder.field("Created at", `<t:${Math.floor(user.createdAt / 1000)}:F>`);
        return message.channel.createMessage({
          messageReference: {
            messageID: message.id,
            failIfNotExists: false,
          },
          embeds: [builder.build()],
        });
      }
    }
    if (!member) {
      member = message.member;
    }
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
    const filteredRoles = member.roles.filter((role) => role !== message.guildID);
    const roles = `${filteredRoles.map((x) => `<@&${x}>`).join(" ")}`;
    builder.color("theme");
    builder.author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256));
    builder.description(`${member.mention} \`(id: ${member.id})\``);
    builder.field("Created at", `<t:${Math.floor(member.user.createdAt / 1000)}:F>`);
    builder.field("Joined Server at", `<t:${Math.floor((member.joinedAt ?? 0) / 1000)}:F>`);
    builder.field(
      `Roles (${filteredRoles.length})`,
      (roles.length <= 1024 ? roles : "Too much to display!") || "None"
    );
    builder.field("Admin Perms", permissions.join(", ") || "None");
    builder.thumbnail(member.user.dynamicAvatarURL(undefined, 512));
    return message.channel.createMessage({
      messageReference: { messageID: message.id, failIfNotExists: false },
      embeds: [builder.build()],
    });
  }
}
export default Userinfo;
