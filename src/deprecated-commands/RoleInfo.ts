import { ClientLegacyCommand as Command, ExecuteArgs } from "../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../core/client/ProtonClient";
import { FormattedPerms } from "../Constants.js";
import { EmbedBuilder } from "../utils/EmbedBuilder.js";

class RoleInfo extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "roleinfo",
      description: "View information about a specific role.",
      usage: "<role_name|role_id|role_mention>",
      aliases: ["role", "ri"],
      category: "information",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  execute({ message, args }: ExecuteArgs) {
    const role = this.parseRole(args.join(" "), message.channel.guild);
    if (!role) {
      return this.errorMessage(
        message,
        "You need to specify a valid role, using its name, id, or by mentioning it."
      );
    }
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
      .field("Position", `${role.position}/${message.channel.guild.roles.size}`, true)
      .field("Mention", `\`${role.mention}\``, true)
      .field("Hoisted", role.hoist ? "true" : "false", true)
      .field("Mentionable", role.mentionable ? "true" : "false", true)
      .field("Permissions", perms.join(", ") || "No permissions", false)
      .color(role.color ? `#${role.color.toString(16)}` : "theme");
    return message.channel.createMessage({
      messageReference: { messageID: message.id },
      embeds: [builder.build()],
    });
  }
}
export default RoleInfo;
