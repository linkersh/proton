import ClientModule from "../core/structs/ClientModule";
import logger from "../core/structs/Logger";
import { ProtonClient } from "../core/client/ProtonClient";
import { collections } from "../core/database/DBClient";
import { StarboardMessage } from "../core/database/models/StarboardMessage";
import { RateLimiter } from "../utils/RateLimiter";
import { getTag } from "../utils/Util";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { Member, Message, PartialEmoji, PossiblyUncachedMessage } from "eris";
import { DefaultAvatar } from "../Constants";

const DEFAULT_MIN_STARS = 2;
const attachmentsRegex = /https:\/\/(cdn|media)\.discordapp\.com\/[^\s]{1,}\.(png|jpg|jpeg|gif)/g;

class StarboardCache {
  private readonly cache: Map<string, StarboardMessage> = new Map();
  find(messageID: string, guildID: string): Promise<StarboardMessage | null> {
    return new Promise((resolve, reject) => {
      const val = this.cache.get(messageID);
      if (val) return resolve(val);
      collections.starboard_messages
        .findOne({
          guildID: guildID,
          $or: [{ starboardMsgID: messageID }, { rootMessageID: messageID }],
        })
        .then((data) => {
          if (data) {
            this.cache.set(data.rootMessageID, data);
            if (data.starboardMsgID !== null) {
              this.cache.set(data.starboardMsgID, data);
            }
          }
          resolve(data);
        })
        .catch(reject);
    });
  }

  update(data: StarboardMessage) {
    this.cache.set(data.rootMessageID, data);
    if (data.starboardMsgID !== null) {
      this.cache.set(data.starboardMsgID, data);
    }
  }

  delete(messageID: string) {
    const val = this.cache.get(messageID);
    if (val) {
      this.cache.delete(val.rootMessageID);
      if (val.starboardMsgID !== null) {
        this.cache.delete(val.starboardMsgID);
      }
    }
  }
}

export default class Starboard extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "Starboard");
  }

  readonly cache = new StarboardCache();
  private readonly ratelimiter = new RateLimiter({
    time: 10 * 1000,
    maxPoints: 20,
    interval: true,
  });

  buildEmbeds(msg: StarboardMessage) {
    let color = "#ffc20c";
    if (msg.reactors.length <= 3) {
      color = "#ffdb70";
    } else if (msg.reactors.length <= 5) {
      color = "#ffd147";
    }

    const jumpLink = `https://discord.com/channels/${msg.guildID}/${msg.rootChannelID}/${msg.rootMessageID}`;
    const tag = getTag(msg.author);

    const format = msg.author.avatar.includes("/a_") ? "gif" : "png";
    const size = 256;
    const avatar = msg.author.avatar.includes("https")
      ? msg.author.avatar
      : `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.${format}?size=${size}`;

    const builder = new EmbedBuilder()
      .author(tag, avatar)
      .description(msg.content)
      .field(`Jump to message`, `[Here](${jumpLink})`)
      .color(color)
      .timestamp(msg.createdAt);
    const embeds = [builder];
    if (msg.attachments.length > 0) {
      builder.image(msg.attachments[0]);
      for (let x = 1; x < Math.min(msg.attachments.length, 10); x++) {
        embeds.push(new EmbedBuilder().image(msg.attachments[x]).color(color));
      }
      if (msg.attachments.length > 10) {
        for (let x = 0; x < Math.min(msg.attachments.length - 10, 10); x++) {
          embeds[x].thumbnail(msg.attachments[x + 10]).color(color);
        }
      }
    }

    return {
      embeds: embeds.map((em) => em.build()),
      content: `⭐ **${msg.reactors.length}** stars in <#${msg.rootChannelID}>`,
    };
  }

  async messageReactionAdd(message: PossiblyUncachedMessage, emoji: PartialEmoji, member: Member) {
    if (emoji.name !== "⭐" || !message.guildID || !this.ratelimiter.check(member.id)) {
      return;
    }
    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(message.guildID);
    } catch (err) {
      logger.error(
        `starboard: messageReactionAdd: failed to retrive guild config for guild: ${message.guildID}`,
        err
      );
      return;
    }
    if (!guildConfig || !guildConfig.starboard || !guildConfig.starboard.channel) {
      return;
    }

    let starMsg: StarboardMessage | null = null;
    try {
      starMsg = await this.cache.find(message.id, message.guildID);
    } catch (err) {
      logger.error(
        `starboard: messageReactionAdd: failed to retrive starboard message in guild: ${message.guildID}, message: ${message.id}`,
        err
      );
      return;
    }

    const minStars = guildConfig.starboard.minStars ?? DEFAULT_MIN_STARS;
    if (starMsg && starMsg.starboardMsgID) {
      if (starMsg.reactors.includes(member.id)) {
        return;
      }
      this.client
        .editMessage(
          guildConfig.starboard.channel,
          starMsg.starboardMsgID,
          this.buildEmbeds({
            ...starMsg,
            reactors: [...starMsg.reactors, member.id],
          })
        )
        .then(() => {
          return collections.starboard_messages.updateOne(
            {
              guildID: message.guildID,
              starboardMsgID: starMsg?.starboardMsgID,
            },
            { $addToSet: { reactors: member.id } }
          );
        })
        .catch((err) => {
          logger.error(
            `starboard: messageReactionAdd: failed to add a reactor to message: ${starMsg?.starboardMsgID} in guild: ${message.guildID}`,
            err
          );
        });
    } else if (starMsg && starMsg.starboardMsgID === null) {
      if (starMsg.reactors.includes(member.id)) {
        return;
      }
      let staboardMsgID: string | null = null;
      if (starMsg.reactors.length + 1 >= minStars) {
        try {
          const starboardMsg = await this.client.createMessage(
            guildConfig.starboard.channel,
            this.buildEmbeds(starMsg)
          );
          staboardMsgID = starboardMsg.id;
        } catch (err) {
          logger.error(
            `starboard: messageReactionAdd: failed to create message in starboard channel`,
            err
          );
          return;
        }
      }
      collections.starboard_messages
        .updateOne(
          { guildID: message.guildID, rootMessageID: message.id },
          {
            $set: {
              starboardMsgID: staboardMsgID,
              reactors: [...starMsg.reactors, member.id],
            },
          }
        )
        .catch((err) => {
          logger.error(
            `starboard: message reaction add: failed to update starboard message in channel: ${message.channel.id}, message: ${message.id}`,
            err
          );
        });
    } else {
      let reactors, msg: Message;
      try {
        reactors = await this.client.getMessageReaction(message.channel.id, message.id, "⭐", {
          limit: 25,
        });
        if (!("content" in message.channel)) {
          msg = await this.client.getMessage(message.channel.id, message.id);
        } else {
          msg = message as unknown as Message;
        }
      } catch (err) {
        logger.error(
          `starboard: message reaction add: failed to fetch reaction/message channel id: ${message.channel.id}, message id: ${message.id}`,
          err
        );
        return;
      }
      if (!reactors || !msg) {
        return;
      }
      if (guildConfig.starboard.ignoreBots) {
        reactors = reactors.filter((r) => !r.bot);
      }
      if (guildConfig.starboard.ignoreSelf) {
        const idx = reactors.findIndex((r) => r.id === msg.author.id);
        if (idx > -1) {
          reactors.splice(idx, 1);
        }
      }
      if (reactors.length === 0) {
        return;
      }

      const attachmentTypes = ["image/gif", "image/jpeg", "image/png", "image/apng"];
      const attachments = [];
      for (let x = 0; x < Math.min(msg.attachments.length, 10); x++) {
        const att = msg.attachments[x];
        if (att.content_type && attachmentTypes.includes(att.content_type)) {
          attachments.push(att.url);
        }
      }

      const attachmentsInContent = (msg.content || "").match(attachmentsRegex);
      if (attachmentsInContent !== null) {
        attachments.push(...attachmentsInContent);
      }

      const acceptedEmbedTypes = ["image", "video", "gifv"];
      for (let x = 0; x < msg.embeds.length; x++) {
        const embed = msg.embeds[x];
        if (embed && embed.url) {
          if (embed.type in acceptedEmbedTypes) {
            attachments.push(embed.url);
          }
        }
      }

      const data: StarboardMessage = {
        guildID: message.guildID,
        rootMessageID: msg.id,
        rootChannelID: msg.channel.id,
        reactors: reactors.map((u) => u.id),
        content: msg.content,
        attachments: attachments,
        starboardMsgID: null,
        createdAt: new Date(),
        author: {
          username: msg.author.username,
          discriminator: msg.author.discriminator,
          id: msg.author.id,
          avatar: msg.member?.avatarURL ?? DefaultAvatar,
        },
      };
      if (reactors.length >= minStars) {
        let starboardMsg;
        try {
          starboardMsg = await this.client.createMessage(
            guildConfig.starboard.channel,
            this.buildEmbeds(data)
          );
        } catch (err) {
          logger.error(
            `starboard: messageReactionAdd: failed to create message in starboard channel`,
            err
          );
          return;
        }
        if (starboardMsg) {
          data.starboardMsgID = starboardMsg.id;
          try {
            await collections.starboard_messages.insertOne(data);
          } catch (err) {
            logger.error(
              `starboard: message reaction add: failed to create starboard message in channel: ${message.channel.id}, message: ${message.id}`,
              err
            );
          }
        }
      }
    }
  }

  async messageReactionRemove(
    message: PossiblyUncachedMessage,
    emoji: PartialEmoji,
    userID: string
  ) {
    if (!message.guildID) {
      return;
    }
    if (emoji.name !== "⭐") {
      return;
    }
    if (!this.ratelimiter.check(userID)) {
      return;
    }

    let guildConfig;
    try {
      guildConfig = await this.client.getGuildConfig(message.guildID);
    } catch (err) {
      logger.error(
        `starboard: messageReactionRemove: failed to retrive guild config for guild: ${message.guildID}`,
        err
      );
      return;
    }
    if (!guildConfig || !guildConfig.starboard || !guildConfig.starboard.channel) {
      return;
    }

    let starMsg: StarboardMessage | null = null;
    try {
      starMsg = await this.cache.find(message.id, message.guildID);
    } catch (err) {
      logger.error(
        `starboard: messageReactionRemove: failed to retrive starboard message in guild: ${message.guildID}, message: ${message.id}`,
        err
      );
      return;
    }
    if (!starMsg) {
      return;
    }

    const minStars = guildConfig.starboard.minStars ?? DEFAULT_MIN_STARS;
    if (starMsg.reactors.length - 1 < minStars && starMsg.starboardMsgID) {
      this.client
        .deleteMessage(guildConfig.starboard.channel, starMsg.starboardMsgID)
        .catch((err) => {
          logger.error(`starboard: messageReactionRemove: failed to delete starboard message`, err);
        });
      this.cache.delete(starMsg.starboardMsgID);
      collections.starboard_messages
        .deleteOne({
          guildID: message.guildID,
          starboardMsgID: starMsg.starboardMsgID,
        })
        .catch((err) => {
          logger.error(`starboard: messageReactionRemove: failed to delete starboard message`, err);
        });
    } else {
      collections.starboard_messages
        .updateOne(
          {
            guildID: message.guildID,
            rootMessageID: starMsg.rootMessageID,
          },
          { $pull: { reactors: userID } }
        )
        .catch((err) => {
          logger.error("starboard: messageReactionRemove: failed to remove reactor", err);
        });
      if (starMsg.starboardMsgID) {
        this.client
          .editMessage(
            guildConfig.starboard.channel,
            starMsg.starboardMsgID,
            this.buildEmbeds({
              ...starMsg,
              reactors: starMsg.reactors.filter((r) => r !== userID),
            })
          )
          .catch((err) => {
            logger.error("starboard: messageReactionRemove: failed to update message", err);
          });
      }
    }
  }
}
