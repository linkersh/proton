import { GuildTextableChannel, Message } from "eris";
import { FilterAi, GuildConfig } from "../../core/database/models/GuildConfig";
import { countEmojis } from "../../utils/Util";
import { AutomodActions, AutoModWhitelistFilterTypes } from "../../Constants";
import AutoMod from ".";
import logger from "../../core/structs/Logger";
import Analyzer, { AnalyzeSchema } from "../Analyzer";
import stringSimilarity from "string-similarity";

const linkRegex = /https?:\/\/[0-9A-Za-z-._~]{1,}(\/?[0-9A-Za-z-._~^\S*]{1,})/g;
const inviteRegex = /discord((?:app.com|.com|.gg)\/invite|.me|.io|.gg)\/([a-zA-Z0-9-]+)/gi;
const duplicatesRegex = /(.+)\1{9,}/;
const capsRegex = /[^A-Z]/g;

const attachments = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.attachments) {
    return false;
  }
  const attachments = config.automod.attachments;
  const key = `${message.guildID}_${message.author.id}`;
  const attachmentCount = message.attachments.length;
  if (attachmentCount === 0) {
    return false;
  }
  automod.attachmentCache.increment(key, attachmentCount, message.id);
  const data = automod.attachmentCache.check(key, attachments.max_attachments, attachments.seconds);
  if (data !== false) {
    automod.attachmentCache.reset(key);
    automod.attachmentCache.moderate(message, config, attachments, data);
    return true;
  }
  return false;
};

const emojis = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.emojis) {
    return false;
  }
  const emojis = config.automod.emojis;
  const key = `${message.guildID}_${message.author.id}`;
  const emojiCount = countEmojis(message.content);

  automod.emojiCache.increment(key, emojiCount, message.id);
  const data = automod.emojiCache.check(key, emojis.max_emojis, emojis.seconds);
  if (data !== false) {
    automod.emojiCache.reset(key);
    automod.emojiCache.moderate(message, config, emojis, data);
    return true;
  }
  return false;
};

const links = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.links) {
    return false;
  }

  const { links } = config.automod;

  if (
    typeof config.automod.links_https_only === "undefined" &&
    (!config.automod.bad_domains || config.automod.bad_domains.length === 0)
  ) {
    return false;
  }

  let punish = false;
  let reason = "";
  for (const match of message.content.matchAll(linkRegex)) {
    const str = match[0];
    try {
      const url = new URL(str);

      if (config.automod.links_https_only && url.protocol !== "https") {
        punish = true;
        reason = `Sent a non-https link: || \`${str}\` ||`;
      }
      if (config.automod.bad_domains && config.automod.bad_domains.includes(url.hostname)) {
        punish = true;
        reason = `Sent a blacklisted domain: || \`${str}\` ||`;
      }
    } catch (err) {
      logger.warn("Failed to create a url from regex match", err);
    }
  }
  if (!punish) {
    return false;
  }

  if (
    links.actions & AutomodActions.DELETE_MESSAGE &&
    message.channel.permissionsOf(automod.client.user.id)?.has("manageMessages")
  ) {
    automod.moderator.delete(message.channel.id, message.id);
  }
  automod.moderator
    .judge(message, config, links, reason, `${message.author.mention}, don't send server invites!`)
    .catch((err) => {
      logger.error(`automod: invites: failed to judge user`, err);
    });
  return true;
};

const mentions = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.mentions) {
    return false;
  }
  const mentions = config.automod.mentions;
  const key = `${message.guildID}_${message.author.id}`;
  const mentionCount = message.mentions.length;
  automod.mentionCache.increment(key, mentionCount, message.id);
  const data = automod.mentionCache.check(key, mentions.max_mentions, mentions.seconds);
  if (data !== false) {
    automod.mentionCache.reset(key);
    automod.mentionCache.moderate(message, config, mentions, data);
    return true;
  }
  return false;
};

const spam = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.spam) {
    return false;
  }
  const messages = config.automod.spam;
  const key = `${message.guildID}_${message.author.id}`;
  automod.messageCache.increment(key, 1, message.id);
  const data = automod.messageCache.check(key, messages.max_messages, messages.seconds);
  if (data !== false) {
    automod.messageCache.reset(key);
    automod.messageCache.moderate(message, config, messages, data);
    return true;
  }
  return false;
};

const stickers = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.stickers || !message.stickerItems) {
    return false;
  }
  const stickers = config.automod.stickers;
  const key = `${message.guildID}_${message.author.id}`;
  const stickerCount = message.stickerItems.length;
  automod.stickerCache.increment(key, stickerCount, message.id);
  const data = automod.stickerCache.check(key, stickers.max_stickers, stickers.seconds);
  if (data !== false) {
    automod.stickerCache.reset(key);
    automod.stickerCache.moderate(message, config, stickers, data);
    return true;
  }
  return false;
};

const invites = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.invites) {
    return false;
  }
  const match = inviteRegex.exec(message.content);
  if (!match || match.length < 3) {
    return false;
  }

  const invites = config.automod.invites;
  const url = match[2];
  let invite;
  try {
    invite = await automod.client.getInvite(url, false);
  } catch (err) {
    logger.error(`automod: invites: failed to fetch invite: ${url}`, err);
  }

  if (!invite) {
    return false;
  }
  if (!invite.guild || !invite.guild.id) {
    return false;
  }
  if (config.automod?.allowedInvites && config.automod.allowedInvites.includes(invite.guild.id)) {
    return false;
  }
  if (
    invites.actions & AutomodActions.DELETE_MESSAGE &&
    message.channel.permissionsOf(automod.client.user.id)?.has("manageMessages")
  ) {
    automod.moderator.delete(message.channel.id, message.id);
  }
  automod.moderator
    .judge(
      message,
      config,
      invites,
      `Sent an invite link: ${url}`,
      `${message.author.mention}, don't send server invites!`
    )
    .catch((err) => {
      logger.error(`automod: invites: failed to judge user`, err);
    });
  return true;
};

const duplicates = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.duplicates) {
    return false;
  }

  if (!duplicatesRegex.test(message.content)) {
    return false;
  }

  const duplicates = config.automod.duplicates;
  if (
    duplicates.actions & AutomodActions.DELETE_MESSAGE &&
    message.channel.permissionsOf(automod.client.user.id)?.has("manageMessages")
  ) {
    automod.moderator.delete(message.channel.id, message.id);
  }
  automod.moderator
    .judge(
      message,
      config,
      duplicates,
      `Sent too many repeated characters`,
      `${message.author.mention}, don't use too many repeated characters!`
    )
    .catch((err) => {
      logger.error(`automod: duplicates: failed to judge user`, err);
    });
  return true;
};

const caps = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (message.content.length < 7) {
    return false;
  }

  if (!config.automod || !config.automod.caps) {
    return false;
  }

  const clean = message.content.replace(capsRegex, "");
  const percent = (clean.length * 100) / message.content.length;
  const caps = config.automod.caps;
  if (percent < caps.max_caps) {
    return false;
  }

  if (
    caps.actions & AutomodActions.DELETE_MESSAGE &&
    message.channel.permissionsOf(automod.client.user.id)?.has("manageMessages")
  ) {
    automod.moderator.delete(message.channel.id, message.id);
  }
  automod.moderator
    .judge(
      message,
      config,
      caps,
      `Sent too many upper case characters`,
      `${message.author.mention}, don't use too much UPPER CASE characters!`
    )
    .catch((err) => {
      logger.error(`automod: caps: failed to judge user`, err);
    });
  return true;
};

const badwords = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.automod || !config.automod.badwords) return false;
  if (!config.automod.badwordList || config.automod.badwordList.length === 0) return false;

  const { badwords } = config.automod;
  const scoreWords = config.automod.badwordList.filter((word) => word.match_score !== undefined);
  const strWords = scoreWords.map((x) => x.text);
  const segments = message.content
    .split(" ")
    .filter((x) => x.length > 2)
    .map((x) => x.toLowerCase());
  let word = config.automod.badwordList.find(
    (word) => word.exact_match && segments.includes(word.text.toLowerCase())
  )?.text;
  let score = word ? 100 : 0;

  if (!word && strWords.length > 0) {
    for (let x = 0; x < segments.length; x++) {
      const segment = segments[x];
      const match = stringSimilarity.findBestMatch(segment, strWords);
      const scoreWord = scoreWords[match.bestMatchIndex];
      if (scoreWord && scoreWord.match_score !== undefined) {
        if (scoreWord.match_score <= match.bestMatch.rating) {
          word = scoreWord.text;
          score = match.bestMatch.rating * 100;
          break;
        }
      }
    }
  }

  if (!word) return false;
  if (badwords.actions & AutomodActions.DELETE_MESSAGE)
    automod.moderator.delete(message.channel.id, message.id);

  automod.moderator
    .judge(
      message,
      config,
      badwords,
      `Used a blacklisted word: ${word}, match score: ${score.toFixed(2)}%`,
      `${message.author.mention}, don't use blacklisted words.`
    )
    .catch((err) => {
      logger.error(`automod: badwords: failed to judge user`, err);
    });
  return true;
};

const googleAI = async (
  message: Message<GuildTextableChannel>,
  config: GuildConfig,
  automod: AutoMod
) => {
  if (!config.isPremium) {
    return false;
  }
  if (!config.automod || message.content.length === 0) {
    return false;
  }
  const requestedAttributes: AnalyzeSchema["requestedAttributes"] = {
    TOXICITY: undefined,
    INSULT: undefined,
    SPAM: undefined,
  };
  if (
    config.automod.toxicity &&
    !automod.isWhitelisted(message, AutoModWhitelistFilterTypes.TOXICITY, config)
  ) {
    requestedAttributes["TOXICITY"] = {};
  }
  if (
    config.automod.insults &&
    !automod.isWhitelisted(message, AutoModWhitelistFilterTypes.INSULTS, config)
  ) {
    requestedAttributes["INSULT"] = {};
  }
  if (
    config.automod.spam_messages &&
    !automod.isWhitelisted(message, AutoModWhitelistFilterTypes.SPAMMY_MESSAGES, config)
  ) {
    requestedAttributes["SPAM"] = {};
  }
  if (Object.keys(requestedAttributes).length === 0) {
    return false;
  }

  const analyzer = automod.client.modules.get("Analyzer") as Analyzer | undefined;
  if (analyzer === undefined) {
    logger.error(`automod: googleAI: analyzer module not loaded.`);
    return false;
  }

  let data;
  try {
    data = (await analyzer.analyze({
      comment: { text: message.content, type: "PLAIN_TEXT" },
      requestedAttributes: requestedAttributes,
      languages: ["en"],
      doNotStore: true,
      // eslint-disable-next-line
    })) as any;
  } catch (err) {
    logger.error(`automod: googleAI: failed to request for analysis`, err);
  }
  if (!data) {
    return false;
  }
  const attrNames = Object.keys(data.attributeScores);
  let exceeded: "toxicity" | "insults" | "spam_messages" | "" = "";
  for (const attribute of attrNames) {
    const value = data.attributeScores[attribute].summaryScore.value;
    switch (attribute) {
      case "TOXICITY": {
        if (config.automod.toxicity && value >= config.automod.toxicity.max_score) {
          exceeded = "toxicity";
        }
        break;
      }
      case "INSULT": {
        if (config.automod.insults && value >= config.automod.insults.max_score) {
          exceeded = "insults";
        }
        break;
      }
      case "SPAM": {
        if (config.automod.spam_messages && value >= config.automod.spam_messages.max_score) {
          exceeded = "spam_messages";
        }
        break;
      }
    }
    if (exceeded !== "") {
      const attributeCfg = config.automod[exceeded] as FilterAi;
      if (
        attributeCfg &&
        attributeCfg.actions & AutomodActions.DELETE_MESSAGE &&
        message.channel.permissionsOf(automod.client.user.id)?.has("manageMessages")
      ) {
        automod.moderator.delete(message.channel.id, message.id);
      }
      let reason = "";
      let warnReason = "";
      if (exceeded === "toxicity") {
        reason = `Exceeded max toxicity level with a score of: ${(value * 100).toFixed(2)}%.`;
        warnReason = `${message.author.mention}, chill out!`;
      } else if (exceeded === "insults") {
        reason = `Exceeded max insults level with a score of: ${(value * 100).toFixed(2)}%.`;
        warnReason = `${message.author.mention}, don't insult others!`;
      } else if (exceeded === "spam_messages") {
        warnReason = `${message.author.mention}, don't send spammy/suspicious messages!`;
        reason = `Exceeded spammy messages level with a score of: ${(value * 100).toFixed(2)}%.`;
      }
      automod.moderator.judge(message, config, attributeCfg, reason, warnReason).catch((err) => {
        logger.error(`automod: googleAI: failed to judge user`, err);
      });
      return true;
    }
  }
};

export default {
  attachments,
  emojis,
  links,
  mentions,
  spam,
  stickers,
  invites,
  duplicates,
  caps,
  badwords,
  googleAI,
};
