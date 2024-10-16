import {
  EmbedOptions,
  Message,
  PossiblyUncachedMessage,
  PossiblyUncachedTextableChannel,
  User,
} from "eris";
import { ProtonClient } from "../../core/client/ProtonClient";
import { Base } from "../../core/structs/Base";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import { getTag } from "../../utils/Util";
import { DefaultAvatar, ServerLogColors } from "../../Constants";
import { collections } from "../../core/database/DBClient";
import { GuildConfig } from "../../core/database/models/GuildConfig";
import logger from "../../core/structs/Logger";
import TimeoutBucket from "../../utils/TimeoutBucket";

export default class MessageLogger extends Base {
  constructor(client: ProtonClient) {
    super(client);
  }

  private readonly bucket = new TimeoutBucket<EmbedOptions>({
    maxItems: 10,
    waitFor: 5_000,
    callback: (this.callback = this.callback.bind(this)),
  });

  callback(key: string, value: EmbedOptions[]) {
    this.client.createMessage(key, { embeds: value }).catch((err) => {
      logger.error("message logger: failed to create a log", err);
    });
  }

  // copy from Moderation module
  getUser(id: string): Promise<User | null> {
    return new Promise((resolve) => {
      const user = this.client.users.get(id);
      if (user) {
        return resolve(user);
      }
      this.client
        .getRESTUser(id)
        .then((u) => {
          if (u) {
            this.client.users.add(u, this.client);
          }
          return resolve(u);
        })
        .catch(() => resolve(null));
    });
  }

  async messageCreate(guildConfig: GuildConfig, message: Message<PossiblyUncachedTextableChannel>) {
    if (!message.guildID || !("guild" in message.channel)) {
      return;
    }
    if (!guildConfig.logs || !guildConfig.logs.message) {
      return;
    }

    const channel = message.channel.guild.channels.get(guildConfig.logs.message);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel")) {
      return;
    }
    collections.messages
      .insertOne({
        id: message.id,
        channel_id: message.channel.id,
        guild_id: message.guildID,
        user_id: message.author.id,
        content: message.content,
        created_at: new Date(message.createdAt),
      })
      .catch((err) => {
        logger.error("message logger: message create: failed to insert message", err);
      });
  }
  async messageDelete(message: PossiblyUncachedMessage) {
    if (!message.guildID) {
      return;
    }
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(message.guildID);
    } catch (err) {
      logger.error("message logger: message delete: failed to fetch guild config", err);
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.message) {
      return;
    }

    if (
      guildConfig.logs.msgIgnoredChannels &&
      guildConfig.logs.msgIgnoredChannels.includes(message.channel.id)
    ) {
      return;
    }

    const guild = this.client.guilds.get(message.guildID);
    if (!guild) {
      return;
    }
    const channel = guild.channels.get(guildConfig.logs.message);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    let resolvedMsg;
    try {
      resolvedMsg = (
        await collections.messages.findOneAndDelete({
          channel_id: message.channel.id,
          id: message.id,
        })
      ).value;
    } catch (err) {
      logger.error("message logger: message delete: failed to fetch deleted message from db", err);
    }
    if (!resolvedMsg) {
      return;
    }
    const author = await this.getUser(resolvedMsg.user_id);
    const channelName = "name" in message.channel ? message.channel.name : "UNKNOWN_CHANNEL_NAME";
    const builder = new EmbedBuilder()
      .title("Message deleted")
      .description(
        `<@!${resolvedMsg.user_id}> (\`id ${resolvedMsg.user_id}\`)\nDeleted in: <#${resolvedMsg.channel_id}> \`[${channelName}]\``
      )
      .color(ServerLogColors.REMOVE)
      .author(
        author ? getTag(author) : "Unkown User#0000",
        author ? author.dynamicAvatarURL(undefined, 256) : DefaultAvatar
      );
    if (resolvedMsg.content && resolvedMsg.content.length) {
      builder.field(
        "Content:",
        resolvedMsg.content.slice(0, 1024) || "UNKOWN_MESSAGE_CONTENT",
        false
      );
    }
    this.bucket.push(channel.id, builder.build());
  }
  async messageUpdate(message: Message<PossiblyUncachedTextableChannel>) {
    if (!message.guildID || message.author.bot || !("name" in message.channel)) {
      return;
    }
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(message.guildID);
    } catch (err) {
      logger.error("message logger: message update: failed to fetch guild config", err);
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.message) {
      return;
    }

    if (
      guildConfig.logs.msgIgnoredChannels &&
      guildConfig.logs.msgIgnoredChannels.includes(message.channel.id)
    ) {
      return;
    }

    const guild = this.client.guilds.get(message.guildID);
    if (!guild) {
      return;
    }
    const channel = guild.channels.get(guildConfig.logs.message);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    let oldMessage;
    try {
      oldMessage = (
        await collections.messages.findOneAndUpdate(
          { channel_id: message.channel.id, id: message.id },
          { $set: { content: message.content } },
          { returnDocument: "before", upsert: true }
        )
      ).value;
    } catch (err) {
      logger.error("message logger: message update: failed to find and update message", err);
    }

    if (!oldMessage) {
      return;
    }
    const builder = new EmbedBuilder()
      .title("Message edited")
      .description(
        `${message.author.mention} (\`id ${message.author.id}\`)\nEdited in: <#${message.channel.id}> \`[${message.channel.name}]\``
      )
      .color(ServerLogColors.MODIFY)
      .author(
        getTag(message.author),
        message.author.dynamicAvatarURL(undefined, 256) || DefaultAvatar
      );
    if (message.content !== oldMessage.content) {
      builder
        .field("Content:", `${message.content.slice(0, 1024) || "UNKOWN_NEW_CONTENT"}`, true)
        .field(
          "Old content:",
          `${oldMessage.content.slice(0, 1024) || "UNKOWN_OLD_CONTENT"}`,
          true
        );
    } else {
      return;
    }
    this.bucket.push(channel.id, builder.build());
  }
  async messageDeleteBulk(messages: PossiblyUncachedMessage[]) {
    if (messages.length === 0) {
      return;
    }
    const guildID = messages[0].guildID;
    if (!guildID) {
      return;
    }

    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(guildID);
    } catch (err) {
      logger.error("message logger: message delete bulk: failed to fetch guild config", err);
    }
    if (!guildConfig || !guildConfig.logs || !guildConfig.logs.message) {
      return;
    }

    if (
      guildConfig.logs.msgIgnoredChannels &&
      guildConfig.logs.msgIgnoredChannels.includes(messages[0].channel.id)
    ) {
      return;
    }

    const guild = this.client.guilds.get(guildID);
    if (!guild) {
      return;
    }
    const channel = guild.channels.get(guildConfig.logs.message);
    if (!channel) {
      return;
    }

    const perms = channel.permissionsOf(this.client.user.id);
    if (!perms || !perms.has("viewChannel") || !perms.has("sendMessages")) {
      return;
    }

    const messageIDs = messages.map((msg) => msg.id);
    let resolvedMsgs;
    try {
      resolvedMsgs = await collections.messages
        .find({
          channel_id: messages[0].channel.id,
          id: { $in: messageIDs },
        })
        .toArray();
    } catch (err) {
      logger.error("message logger: message delete bulk: failed to fetch messages", err);
    }
    if (!resolvedMsgs || resolvedMsgs.length === 0) {
      return;
    }

    collections.messages
      .deleteMany({
        channel_id: messages[0].channel.id,
        id: { $in: messageIDs },
      })
      .catch((err) =>
        logger.error(
          "message logger: message delete bulk: failed to delete collected messages",
          err
        )
      );
    let string = "";
    for (let x = 0; x < resolvedMsgs.length; x++) {
      const msg = resolvedMsgs[x];
      const timestamp = msg.created_at.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      });
      string += `Content: ${msg.content}\nAuthor: ${msg.user_id}\nTimestamp: ${timestamp}\nID: ${msg.id}\n\n`;
    }
    this.client
      .createMessage(channel.id, {}, [{ name: "messages.txt", file: Buffer.from(string, "utf-8") }])
      .catch((err) => {
        logger.error("message logger: message delete bulk: failed to create bulk delete log", err);
      });
  }
}
