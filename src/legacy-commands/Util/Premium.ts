import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import Logger from "../../core/structs/Logger.js";
import { EmbedBuilder } from "../../utils/EmbedBuilder.js";
import { collections } from "../../core/database/DBClient";
import { Guild } from "eris";

class Premium extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "premium",
      description: "Manage your premium subscription",
      usage: "",
      commands: [
        {
          name: "add",
          desc: "Add an premium server.",
          cooldown: 3000,
          usage: "<server-id>",
        },
        {
          name: "remove",
          desc: "Remove a premium server.",
          cooldown: 3000,
          usage: "<server-id>",
        },
        {
          name: "info",
          desc: "Your premium info, including premium servers.",
          cooldown: 3000,
          usage: "",
        },
      ],
      aliases: ["prem"],
      category: "util",
      cooldown: 3000,
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  async add({ message, args }: ExecuteArgs) {
    const id = args[0];
    if (!this.client.guilds.has(id)) {
      return this.errorMessage(message, `That is not a valid server I'm in.`);
    }
    const data = await Promise.all([
      collections.subscriptions.findOne({ userID: message.author.id }),
      this.client.getGuildConfig(id),
    ]);
    const premium = data[0];
    const config = data[1];
    if (!premium || !premium.serverSlots) {
      return this.errorMessage(
        message,
        `You're not premium. Get premium @ https://proton-bot.net/premium`
      );
    }
    if (config?.isPremium) {
      return this.errorMessage(message, `This server is already premium.`);
    }
    if (premium.serverSlots <= premium.servers.length) {
      return this.errorMessage(message, `You do not have any premium server slots left.`);
    }
    const promises = [
      collections.subscriptions.updateOne(
        { userID: message.author.id },
        { $push: { servers: id } }
      ),
      collections.guildconfigs.updateOne(
        { _id: id },
        { $set: { isPremium: true } },
        { upsert: true }
      ),
    ];
    await Promise.all(promises);
    this.successMessage(message, `Server ${id} is now premium.`);
  }
  async remove({ message, args }: ExecuteArgs) {
    const id = args[0];
    if (!this.client.guilds.has(id)) {
      return this.errorMessage(message, `That is not a valid server I'm in.`);
    }
    const premium = await collections.subscriptions.findOne({
      userID: message.author.id,
    });
    if (!premium || !premium.serverSlots) {
      return this.errorMessage(
        message,
        `You're not premium. Get premium @ https://proton-bot.net/premium`
      );
    }
    if (premium.servers && !premium.servers.includes(id)) {
      return this.errorMessage(message, `You do not have that server in your premium server list.`);
    }
    const promises = [
      collections.subscriptions.updateOne(
        { userID: message.author.id },
        { $pull: { servers: id } }
      ),
      collections.guildconfigs.updateOne({ _id: id }, { $set: { isPremium: false } }),
    ];
    await Promise.all(promises);
    this.successMessage(message, `Server ${id} is no longer premium.`);
  }
  async info({ message }: ExecuteArgs) {
    const premium = await collections.subscriptions.findOne({
      userID: message.author.id,
    });
    if (!premium || !premium.serverSlots) {
      return this.errorMessage(
        message,
        `You're not premium. Get premium @ https://proton-bot.net/premium`
      );
    }
    if (!premium.servers?.length) {
      return this.errorMessage(message, `You don't haven't set any premium servers.`);
    }
    const guilds = premium.servers
      .map((x) => this.client.guilds.get(x))
      .filter((x) => x !== undefined) as Guild[];
    const builder = new EmbedBuilder()
      .title(`Premium info`)
      .description(`Server slots: **${premium.serverSlots}**`)
      .field(`Premium guilds`, guilds.map((x) => `**${x.name}** (${x.id})`).join("\n"))
      .color("theme");
    message.channel
      .createMessage({ embeds: [builder.build()] })
      .catch((err) => Logger.warn(`command: premium: failed to create message`, err));
  }
}
export default Premium;
