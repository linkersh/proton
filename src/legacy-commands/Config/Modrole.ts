import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class Modrole extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "modrole",
      usage: "<command>",
      description: "Manage moderator roles",
      commands: [
        { name: "add", desc: "Add a moderator role.", cooldown: 3000 },
        {
          name: "remove",
          desc: "Remove a moderator role.",
          cooldown: 3000,
        },
        {
          name: "list",
          desc: "List all the moderator roles.",
          cooldown: 3000,
        },
      ],
      aliases: [],
      category: "config",
      cooldown: 3000,
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async add({ message, args }: ExecuteArgs) {
    const roles = this.parseRoles(args.join(" "), message.channel.guild);
    if (!roles?.length) {
      return this.errorMessage(message, "You need to provide valid role(s).");
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      {
        $addToSet: { "moderation.modroles": { $each: roles } },
      }
    );
    this.successMessage(
      message,
      `Added ${roles.length} modroles: ${roles
        .map(
          (r) =>
            (
              message.channel.guild.roles.get(r) || {
                name: "Unknown role",
              }
            ).name
        )
        .join(", ")}.`
    );
  }
  async remove({ message, args }: ExecuteArgs) {
    const roles = this.parseRoles(args.join(" "), message.channel.guild);
    if (!roles?.length) {
      return this.errorMessage(
        message,
        "You need to provide valid role(s) to remove from modrole list."
      );
    }
    await collections.guildconfigs.updateOne(
      { _id: message.guildID },
      {
        $pull: { "moderation.modroles": { $in: roles } },
      }
    );
    this.successMessage(
      message,
      `Removed ${roles.length} modroles: ${roles
        .map(
          (r) =>
            (
              message.channel.guild.roles.get(r) || {
                name: "Unknown role",
              }
            ).name
        )
        .join(", ")}.`
    );
  }
  list({ message, config }: ExecuteArgs) {
    const modroles = config?.moderation?.modroles;
    if (!modroles || modroles.length === 0) {
      return this.errorMessage(message, "There aren't any modroles.");
    }
    const roles = modroles
      .filter((x) => message.channel.guild.roles.has(x))
      .map((x) => message.channel.guild.roles.get(x));
    if (!roles.length) {
      return this.errorMessage(message, "There aren't any modroles.");
    }
    message.channel.createMessage(
      `Moderator role(s): ${roles.map((x) => x?.name || "UNKOWN_ROLE_NAME").join(", ")}`
    );
  }
}
export default Modrole;
