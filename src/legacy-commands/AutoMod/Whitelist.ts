import { Role, GuildChannel, TextChannel, CategoryChannel } from "eris";
import { AutoModWhitelistDataTypes, AutoModWhitelistFilterTypes } from "../../Constants";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { collections } from "../../core/database/DBClient";
const modules = Object.keys(AutoModWhitelistFilterTypes).map((x) => x.toLowerCase());

class Whitelist extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "whitelist",
      description: "Whitelist roles and channels from specific automod modules.",
      usage: "",
      aliases: [],
      commands: [
        {
          name: "add",
          desc: "Add a whitelisted channel/role.",
          usage: "<module_name> <@role|#channel>",
        },
        {
          name: "remove",
          desc: "Remove a previously whitelisted channel/role.",
          usage: "<module_name> <@role|#channel>",
        },
        {
          name: "info",
          desc: "Information about a speciifc automod module.",
          usage: "<module_name>",
        },
      ],
      cooldown: 3000,
      category: "automod",
      userPerms: ["manageGuild"],
      clientPerms: ["sendMessages"],
    });
  }
  async add({ message, args }: ExecuteArgs) {
    const moduleName = modules.find((x) => args[0]?.toLowerCase()?.includes(x));
    if (!moduleName) {
      return this.errorMessage(
        message,
        `Specify a valid module from: ${modules.map((x) => `\`${x}\``).join(", ")}`
      );
    }
    let data: Role | TextChannel | CategoryChannel | undefined =
      this.parseRole(args.slice(1).join(" "), message.channel.guild) ||
      this.parseChannel(args.slice(1).join(" "), message.channel.guild);
    if (!data) {
      const category = message.channel.guild.channels.get(args[1]);
      if (category?.type === 4) {
        data = category;
      }
    }
    if (!data) {
      return this.errorMessage(message, `Specify a valid role or a channel.`);
    }
    if (data instanceof Role) {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $push: {
            "automod.whitelist": {
              data_type: AutoModWhitelistDataTypes.ROLE,
              filter_type:
                AutoModWhitelistFilterTypes[
                  moduleName.toUpperCase() as keyof typeof AutoModWhitelistFilterTypes
                ],
              id: data.id,
            },
          },
        }
      );
      this.successMessage(
        message,
        `Whitelisted \`@${data.name}\` in ${moduleName} automod module.`
      );
    } else if (data instanceof GuildChannel) {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $push: {
            "automod.whitelist": {
              data_type: AutoModWhitelistDataTypes.CHANNEL,
              filter_type:
                AutoModWhitelistFilterTypes[
                  moduleName.toUpperCase() as keyof typeof AutoModWhitelistFilterTypes
                ],
              id: data.id,
            },
          },
        }
      );
      this.successMessage(
        message,
        `Whitelisted \`#${data.name}\` in ${moduleName} automod module.`
      );
    }
  }
  async remove({ message, args }: ExecuteArgs) {
    const moduleName = modules.find((x) => args[0]?.includes(x));
    if (!moduleName) {
      return this.errorMessage(
        message,
        `Specify a valid module from: ${modules.map((x) => `\`${x}\``).join(", ")}`
      );
    }
    let data: Role | TextChannel | CategoryChannel | undefined =
      this.parseRole(args.slice(1).join(" "), message.channel.guild) ||
      this.parseChannel(args.slice(1).join(" "), message.channel.guild);
    if (!data) {
      const category = message.channel.guild.channels.get(args[1]);
      if (category?.type === 4) {
        data = category;
      }
    }
    if (!data) {
      return this.errorMessage(message, `Specify a valid role or a channel.`);
    }
    if (data instanceof Role) {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $pull: {
            "automod.whitelist": {
              id: data.id,
              data_type: AutoModWhitelistDataTypes.ROLE,
            },
          },
        }
      );
      this.successMessage(
        message,
        `Removed \`@${data.name}\` from whitelist in ${moduleName} automod module.`
      );
    } else if (data instanceof GuildChannel) {
      await collections.guildconfigs.updateOne(
        { _id: message.guildID },
        {
          $pull: {
            "automod.whitelist": {
              id: data.id,
              data_type: AutoModWhitelistDataTypes.CHANNEL,
            },
          },
        }
      );
      this.successMessage(
        message,
        `Removed \`#${data.name}\` from whitelist in ${moduleName} automod module.`
      );
    }
  }
  info({ message, args, config }: ExecuteArgs) {
    if (!config.automod || !config.automod.whitelist || !message.channel.guild) {
      return this.errorMessage(message, "There is nothing whitelisted.");
    }
    const guildRoles = message.channel.guild.roles;
    const guildChannels = message.channel.guild.channels;
    const moduleName = modules.find((x) => args[0]?.includes(x)) || "global";
    const filterType =
      AutoModWhitelistFilterTypes[
        moduleName.toUpperCase() as keyof typeof AutoModWhitelistFilterTypes
      ];
    const whitelist = config.automod.whitelist.filter((x) => x.filter_type === filterType);
    if (whitelist && whitelist.length === 0) {
      return this.errorMessage(
        message,
        `There are no whitelisted channels & roles for \`${moduleName}\` automod filter.`
      );
    }
    const builder = new EmbedBuilder();
    const roles = [],
      channels = [];
    for (let x = 0; x < whitelist.length; x++) {
      const data = whitelist[x];
      if (data.data_type === AutoModWhitelistDataTypes.ROLE) {
        if (guildRoles.has(data.id)) {
          roles.push(`<@&${data.id}>`);
        } else {
          roles.push(data.id);
        }
      } else {
        if (guildChannels.has(data.id)) {
          channels.push(`<#${data.id}>`);
        } else {
          channels.push(data.id);
        }
      }
    }
    builder
      .field("Whitelisted roles:", roles.join(", ") || "None")
      .field("Whitelisted channels:", channels.join(", ") || "None")
      .title(`Module: ${moduleName}`)
      .color("theme");
    message.channel.createMessage({ embeds: [builder.build()] });
  }
}
export default Whitelist;
