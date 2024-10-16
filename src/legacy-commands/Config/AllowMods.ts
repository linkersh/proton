import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";

class AllowMods extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "allowmods",
      usage: "<command>",
      description:
        "Make a command executable by a user with a moderator role, bypassing the required permissions.",
      commands: [
        {
          name: "add",
          desc: "Add a command to allowed mods.",
          cooldown: 3000,
        },
        {
          name: "remove",
          desc: "Remove a command from allowed mods.",
          cooldown: 3000,
        },
        {
          name: "list",
          desc: "List commands marked as allow mods.",
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
  async add({ message, args, config }: ExecuteArgs) {
    if (!config?.moderation?.modroles?.length) {
      return this.errorMessage(
        message,
        `You need to have at least one mod role setup. Otherwise you can get locked out from specific commands.`
      );
    }
    const command = this.client.legacyCommands.get(this.client.aliases.get(args[0]) || args[0]);
    if (!command) {
      return this.errorMessage(message, "Specify a valid command of mine.");
    }
    if (command.name === this.name) {
      return this.errorMessage(message, `You can not modify this command!`);
    }
    const key = `commands.${command.name}.allowMods`;
    await collections.command_configs.updateOne(
      { _id: message.guildID },
      { $set: { [key]: true } },
      { upsert: true }
    );
    this.successMessage(message, `Marked \`${command.name}\` command as moderator only.`);
  }
  async remove({ message, args }: ExecuteArgs) {
    const command = this.client.legacyCommands.get(this.client.aliases.get(args[0]) || args[0]);
    if (!command) {
      return this.errorMessage(message, "Specify a valid command of mine.");
    }
    const key = `commands.${command.name}.allowMods`;
    await collections.command_configs.updateOne(
      { _id: message.guildID },
      { $unset: { [key]: "" } },
      { upsert: true }
    );
    this.successMessage(message, `Command \`${command.name}\` is no longer allowed to moderators.`);
  }
  list(ctx: ExecuteArgs) {
    if (!ctx.config.commands || !Object.keys(ctx.config.commands).length) {
      return this.errorMessage(ctx.message, "There aren't any moderator-only commands.");
    }
    const modcommands = [];
    for (const [key, value] of Object.entries(ctx.config.commands)) {
      if (value.allowMods === true) {
        modcommands.push(key);
      }
    }
    ctx.message.channel.createMessage(`Moderator only command(s): ${modcommands.join(", ")}`);
  }
}
export default AllowMods;
