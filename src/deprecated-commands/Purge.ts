import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import { GuildTextableChannel, Member, PurgeChannelOptions } from "eris";
import { GuildConfig } from "../../core/database/models/GuildConfig";
import Stats from "../../modules/Stats";

class Purge extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "purge",
      description: "Purge messages with optional filters",
      usage: "<limit|filter>",
      aliases: [],
      commands: [
        {
          name: "member",
          usage: "<member> <limit>",
          desc: "Purge messages of a specific member",
        },
        {
          name: "bots",
          usage: "<limit>",
          desc: "Purge messages sent by bots.",
        },
        {
          name: "humans",
          desc: "Purge messages sent by humans",
          usage: "<limit>",
        },
      ],
      category: "moderation",
      allowMods: true,
      cooldown: 5000,
      clientPerms: ["sendMessages", "manageMessages", "readMessageHistory"],
      userPerms: ["manageMessages"],
    });
  }
  purge(
    options: PurgeChannelOptions,
    channel: GuildTextableChannel,
    config: GuildConfig,
    executor: Member
  ) {
    return new Promise((resolve, reject) => {
      if (this.client.purgeTasks.has(channel.id)) {
        return reject(`There is an on-going purge already!`);
      }
      if (options.limit > 500) {
        options.limit = 500;
      }
      if (options.limit < 2) {
        return reject("Message limit must be above 2.");
      }
      options.limit + 1;
      if (!executor.permissions.has("administrator")) {
        if (
          config.moderation &&
          config.moderation &&
          config.moderation.purgeLimit &&
          config.moderation.purgeLimit < options.limit
        ) {
          return reject(
            `Woah there! You cannot purge more than ${config.moderation.purgeLimit} messages at once!`
          );
        }
      }
      this.client.purgeTasks.set(channel.id, undefined);
      if (!options.filter) {
        options.filter = (msg) => !msg.pinned;
      }
      channel.purge(options).then(() => {
        const stats = this.client.modules.get("Stats") as Stats | undefined;
        if (stats) {
          stats.mods.purges += options.limit;
        }
        this.client.purgeTasks.delete(channel.id);
        resolve(true);
      });
    });
  }
  execute({ message, args, config, prefix }: ExecuteArgs) {
    if (args[0]) {
      const idMatch = /([0-9]{16,19})/.exec(args[0]);
      if (idMatch && this.client.users.has(idMatch[0])) {
        this.purge(
          {
            filter: (msg) => msg.author.id === idMatch[0] && !msg.pinned,
            limit: parseInt(args[1]),
          },
          message.channel,
          config,
          message.member
        ).catch((err) => this.errorMessage(message, err));
      } else {
        this.purge(
          {
            limit: parseInt(args[0]),
          },
          message.channel,
          config,
          message.member
        ).catch((err) => this.errorMessage(message, err));
      }
    } else {
      this.getHelp(message, prefix);
    }
  }
  member({ message, args, config }: ExecuteArgs) {
    const user = message.mentions[0] || this.client.users.get(args[0]);
    if (!user) {
      return this.errorMessage(message, "Mention a member or use their user ID.");
    }
    this.purge(
      {
        filter: (msg) => msg.author.id === user.id && !msg.pinned,
        limit: parseInt(args[1]),
      },
      message.channel,
      config,
      message.member
    ).catch((err) => this.errorMessage(message, err));
  }
  bots({ message, args, config }: ExecuteArgs) {
    this.purge(
      {
        filter: (msg) => msg.author.bot && !msg.pinned,
        limit: parseInt(args[0]),
      },
      message.channel,
      config,
      message.member
    ).catch((err) => this.errorMessage(message, err));
  }
  humans({ message, args, config }: ExecuteArgs) {
    this.purge(
      {
        filter: (msg) => !msg.author.bot && !msg.pinned,
        limit: parseInt(args[0]),
      },
      message.channel,
      config,
      message.member
    ).catch((err) => this.errorMessage(message, err));
  }
}
export default Purge;
