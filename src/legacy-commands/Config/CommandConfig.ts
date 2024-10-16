import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import similarity from "string-similarity";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { collections } from "../../core/database/DBClient";
const permissions = {
  "create invite": "createInstantInvite",
  "kick members": "kickMembers",
  "ban members": "banMembers",
  administrator: "administrator",
  "manage channels": "manageChannels",
  "manage server": "manageGuild",
  "add reactions": "addReactions",
  "view audit log": "viewAuditLog",
  "priority speaker": "voicePrioritySpeaker",
  stream: "stream",
  "view channels": "viewChannel",
  "send messages": "sendMessages",
  "send tts messages": "sendTTSMessages",
  "manage messages": "manageMessages",
  "embed links": "embedLinks",
  "attach files": "attachFiles",
  "read message history": "readMessageHistory",
  "mention everyone": "mentionEveryone",
  "external emojis": "useExternalEmojis",
  "view server insights": "viewGuildInsights",
  connect: "voiceConnect",
  speak: "voiceSpeak",
  "mute members": "voiceMuteMembers",
  "deafean members": "voiceDeafenMembers",
  "move members": "voiceMoveMembers",
  "use voice activity": "voiceUseVAD",
  "change nickname": "changeNickname",
  "manage nicknames": "manageNicknames",
  "manage roles": "manageRoles",
  "manage webhooks": "manageWebhooks",
  "manage emojis": "manageEmojisAndStickers",
};
class CommandConfig extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "commandcfg",
      description: "Configure how commands behave.",
      commands: [
        {
          name: "allow-role",
          desc: "Allow a specific role to use the command.",
          cooldown: 3000,
          usage: "<command_name> <add|remove> <role>",
        },
        {
          name: "disallow-role",
          desc: "Disable a command for a role.",
          cooldown: 3000,
          usage: "<command_name> <add|remove> <role>",
        },
        {
          name: "permissions",
          desc: "Set custom required permissions for a command.",
          cooldown: 3000,
          usage: "<command_name> <add|remove> <role>",
        },
        {
          name: "info",
          desc: "View the config for a specific command.",
          cooldown: 3000,
          usage: "<command_name>",
        },
        {
          name: "disable",
          desc: "Disable/re-enable a command.",
          usage: "<command_name> <disable? true|false>",
        },
      ],
      usage: "",
      cooldown: 4000,
      aliases: [],
      category: "config",
      clientPerms: ["sendMessages"],
      userPerms: ["manageGuild"],
    });
  }
  async "allow-role"(ctx: ExecuteArgs) {
    const commandName = ctx.args[0];
    const command = this.client.legacyCommands.get(
      this.client.aliases.get(commandName) || commandName
    );
    if (!command) {
      return this.errorMessage(ctx.message, "Specify a valid command name.");
    }
    const operation = ctx.args[1]?.toLowerCase() === "add" ? 1 : 0;
    const role = this.parseRole(ctx.args.slice(2).join(" "), ctx.message.channel.guild);
    if (!role) {
      return this.errorMessage(ctx.message, "Please specify a valid role.");
    }
    const key = `commands.${commandName}.allowedRoles`;
    if (operation === 1) {
      await collections.command_configs.updateOne(
        { _id: ctx.message.guildID },
        { $push: { [key]: role.id } },
        { upsert: true }
      );
      this.successMessage(
        ctx.message,
        `Added ${role.name} to allowed-role list for command: \`${commandName}\`.`
      );
    } else {
      await collections.command_configs.updateOne(
        { _id: ctx.message.guildID },
        { $pull: { [key]: role.id } },
        { upsert: true }
      );
      this.successMessage(
        ctx.message,
        `Removed ${role.name} from allowed-role list for command: \`${commandName}\`.`
      );
    }
  }
  async "disallow-role"(ctx: ExecuteArgs) {
    const commandName = ctx.args[0];
    const command = this.client.legacyCommands.get(
      this.client.aliases.get(commandName) || commandName
    );
    if (!command) {
      return this.errorMessage(ctx.message, "Specify a valid command name.");
    }
    const operation = ctx.args[1]?.toLowerCase() === "add" ? 1 : 0;
    const role = this.parseRole(ctx.args.slice(2).join(" "), ctx.message.channel.guild);
    if (!role) {
      return this.errorMessage(ctx.message, "Please specify a valid role.");
    }
    const key = `commands.${commandName}.disallowedRoles`;
    if (operation === 1) {
      await collections.command_configs.updateOne(
        { _id: ctx.message.guildID },
        { $push: { [key]: role.id } },
        { upsert: true }
      );
      this.successMessage(
        ctx.message,
        `Added ${role.name} to disallowed-role list for command: \`${commandName}\`.`
      );
    } else {
      await collections.command_configs.updateOne(
        { _id: ctx.message.guildID },
        { $pull: { [key]: role.id } },
        { upsert: true }
      );
      this.successMessage(
        ctx.message,
        `Removed ${role.name} from disallowed-role list for command: \`${commandName}\`.`
      );
    }
  }
  async permissions(ctx: ExecuteArgs) {
    const commandName = ctx.args[0];
    const command = this.client.legacyCommands.get(
      this.client.aliases.get(commandName) || commandName
    );
    if (!command) {
      return this.errorMessage(ctx.message, "Specify a valid command name.");
    }
    const permStrings = ctx.args
      .slice(1)
      .join(" ")
      .split(",")
      .map((x) => x.toLowerCase().trim());
    const perms: string[] = [];
    const keys = Object.keys(permissions);
    for (const perm of permStrings) {
      let permName = "";
      if (permissions[perm as keyof typeof permissions]) {
        permName = permissions[perm as keyof typeof permissions];
      }
      const found = similarity.findBestMatch(perm, keys);
      if (found && found.bestMatch.rating >= 0.7) {
        permName = permissions[found.bestMatch.target as keyof typeof permissions];
      }
      if (!permName) {
        continue;
      }
      if (perms.includes(permName)) {
        continue;
      }
      perms.push(permName);
    }
    const key = `commands.${commandName}.permissions`;
    await collections.command_configs.updateOne(
      { _id: ctx.message.guildID },
      { $set: { [key]: perms } },
      { upsert: true }
    );
    this.successMessage(ctx.message, `Modified permissions for command: \`${commandName}\`.`);
  }
  async info(ctx: ExecuteArgs) {
    const commandName = ctx.args[0];
    const command = this.client.legacyCommands.get(
      this.client.aliases.get(commandName) || commandName
    );
    if (!command) {
      return this.errorMessage(ctx.message, "Specify a valid command name.");
    }
    const cmdConfig = (ctx.config?.commands || {})[commandName];
    const builder = new EmbedBuilder()
      .title(`${commandName}'s info`)
      .field("Allowed Roles", cmdConfig?.allowedRoles?.map((x) => `<@&${x}>`)?.join(",") || "None")
      .field(
        "Dis-allowed Roles",
        cmdConfig?.disallowedRoles?.map((x) => `<@&${x}>`)?.join(",") || "None"
      )
      .field("Custom permissions", cmdConfig?.permissions?.join(",") || "None")
      .field("Allow Moderators", cmdConfig.allowMods ? "true" : "false");
    ctx.message.channel.createMessage({ embeds: [builder.build()] });
  }
  async disable(ctx: ExecuteArgs) {
    const commandName = ctx.args[0];
    const command = this.client.legacyCommands.get(
      this.client.aliases.get(commandName) || commandName
    );
    if (!command) {
      return this.errorMessage(ctx.message, "Specify a valid command name.");
    }
    const bool = ctx.args[1]?.toLowerCase() === "true" ? true : false;
    await collections.command_configs.updateOne(
      { _id: ctx.message.guildID },
      { $set: { [`commands.${commandName}.disabled`]: bool } },
      { upsert: true }
    );
    this.successMessage(
      ctx.message,
      `${bool ? "Disabled" : "Enabled"} command: \`${commandName}\`.`
    );
  }
}
export default CommandConfig;
