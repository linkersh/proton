import logger from "../core/structs/Logger";
import AutoMod from "../modules/AutoMod";
import AutoResponses from "../modules/AutoResponses";
import Levels from "../modules/Levels";
import Reputation from "../modules/Reputation";
import GuildLogger from "../modules/ServerLogger";
import Tags from "../modules/Tags";
import ClientEvent from "../core/structs/ClientEvent";
import { Constants, GuildChannel, GuildTextableChannel, Message } from "eris";
import { ChannelRestrictionsModeTypes } from "../Constants";
import { collections } from "../core/database/DBClient";
import { CommandLog } from "../core/database/models/CommandLog";
import { GuildConfig } from "../core/database/models/GuildConfig";
import { ExecuteArgs } from "../core/structs/ClientLegacyCommand";
import { EmbedBuilder } from "../utils/EmbedBuilder";
import { getTag, splitArgs } from "../utils/Util";
import { config as appConfig } from "../Config";

let mentionPrefix: RegExp;
const msgLinkRegex =
  /https:\/\/(ptb\.|canary\.)?discord\.com\/channels\/([0-9]{16,19})\/([0-9]{16,19})\/([0-9]{16,19})/;
const mentionRegex = /<@!?([0-9]{16,19})>/;
const thanksRegex = /(^|\s)(thx|thank|thanks|thank you|thanks you|tysm|thnx)(\s|$)/g;

export default new ClientEvent("messageCreate", async (client, message) => {
  if (!mentionPrefix) {
    mentionPrefix = new RegExp(`^(<@!?${client.user.id}>)`);
  }
  if (message.author.bot) {
    return;
  }
  if (
    !message.guildID ||
    !(message.channel instanceof GuildChannel) ||
    !message.channel.lastMessageID
  ) {
    return;
  }
  if (!("name" in message.channel)) {
    return;
  }
  if (!message.member || message.member === null) {
    return;
  }

  if (message.channel.id === "899940176736972851") {
    client
      .getMessages(message.channel.id, { limit: 25 })
      .then((messages) => {
        const text = `**Welcome!** 👋\n\nTo ask a question related to Proton please create a thread in this channel. Either a moderator or a community member will (hopefully) respond to your question.`;
        const msg = messages.find((mesg) => mesg.author.id === client.user.id);
        if (!msg) {
          client.createMessage(message.channel.id, text).catch((err) => {
            logger.error(
              `event: message_create: failed to create new message in #support channel:`,
              err?.message
            );
          });
          return;
        } else {
          client.deleteMessage(message.channel.id, msg.id).catch(() => null);
          client.createMessage(message.channel.id, text).catch((err) => {
            logger.error(
              `event: message_create: failed to create new message in #support channel:`,
              err?.message
            );
          });
          return;
        }
      })
      .catch((err) =>
        logger.error(
          `event: message_create: failed to get messages in support channel:`,
          err?.message
        )
      );
    return;
  }
  if (message.channel.id === "764588350933827616") {
    client
      .createThreadWithMessage(message.channel.id, message.id, {
        name: message.content.slice(0, 100),
        autoArchiveDuration: 1440,
      })
      .then(() => message.addReaction("👍"))
      .then(() => message.addReaction("👎"))
      .catch((err) => {
        logger.error(err);
      });
    return;
  }

  if (message.channel.id === "751379493603508265") {
    client
      .createThreadWithMessage(message.channel.id, message.id, {
        name: message.content.slice(0, 100),
        autoArchiveDuration: 1440,
      })
      .catch((err) => {
        logger.error(err);
      });
    return;
  }

  const messageListeners = client.messageListeners.get(message.channel.id);
  if (messageListeners) {
    for (let x = 0; x < messageListeners.length; x++) {
      messageListeners[x](message as Message<GuildTextableChannel>);
    }
  }

  let config,
    isError = false;
  try {
    config = await client.getGuildConfig(message.guildID);
  } catch (err) {
    logger.error(`messageCreate: failed to fetch guild config`, err);
    isError = true;
  } finally {
    if (!config) {
      config = { _id: message.guildID, prefixes: ["-"] } as GuildConfig;
      await collections.guildconfigs.insertOne(config).catch((err) => {
        isError = true;
        logger.error(`messageCreate: failed to insert guild config`, err);
      });
    }
  }

  if (isError || !config) {
    return;
  }

  if (config.unban_date && config.unban_date > new Date()) {
    return;
  }

  const automod = client.modules.get("AutoMod") as undefined | AutoMod;
  if (automod !== undefined) {
    automod.handleMessage(message as Message<GuildTextableChannel>, config, false);
  } else {
    logger.warn("message create: couldn't find the auto mod module");
  }

  const guildLogger = client.modules.get("GuildLogger") as GuildLogger | undefined;
  if (guildLogger) {
    guildLogger.message.messageCreate(config, message as Message<GuildTextableChannel>);
  } else {
    logger.warn("message create: couldn't find the guild logger module");
  }

  let usedPrefix =
    config.prefixes && config.prefixes.find((prefix) => message.content.startsWith(prefix));
  const mentionMatch = mentionPrefix.exec(message.content);
  if (mentionMatch) {
    usedPrefix = mentionMatch[0];
  }

  let messageArray = usedPrefix
    ? splitArgs(message.content.slice(usedPrefix.length).trimStart())
    : [];
  const args = messageArray.slice(1);
  const commandName = messageArray[0]?.trim();
  const command = client.legacyCommands.get(client.aliases.get(commandName) ?? commandName);
  if (command && usedPrefix) {
    const subcommand = command.commands.find((subcmd) => subcmd.name === args[0]);
    if (client.legacyCommands.cooldowns.ratelimited(message.author.id, command, subcommand)) {
      return;
    }

    if (command.admin && !appConfig.admins.includes(message.author.id)) {
      return;
    }

    const deprecations = [
      { names: ["attachmentspam"], alternative: "attachment-spam" },
      { names: ["duplicates"], alternative: "duplicates" },
      { names: ["emojispam"], alternative: "emoji-spam" },
      { names: ["invites"], alternative: "invites" },
      { names: ["caps"], alternative: "caps-spam" },
      { names: ["mentionspam"], alternative: "mention-spam" },
      { names: ["messagespam"], alternative: "message-spam" },
      { names: ["stickerspam"], alternative: "sticker-spam" },
      { names: ["tag"], alternative: "tag" },
      { names: ["whitelist"], alternative: "whitelist" },
      { names: ["threshold"], alternative: "thresholds" },
      { names: ["username-mod"], alternative: "username-mod" },
      { names: ["badwords"], alternative: "blacklist-words" },
      { names: ["links"], alternative: "bad-links" },
      { names: ["antialts"], alternative: "anti-alts" },
    ];

    for (const deprecation of deprecations) {
      if (deprecation.names.includes(command.name)) {
        client
          .createMessage(
            message.channel.id,
            `This command is deprecated and will be removed, use \`/${deprecation.alternative}\` instead.`
          )
          .catch((err) =>
            logger.error("message create: failed to create deprecation warning", err)
          );
        break;
      }
    }

    const commandCfg = config.commands ? config.commands[command.name] : null;
    if (commandCfg && commandCfg.disabled) {
      return;
    }
    if (!["response", "tag"].includes(command.name)) {
      messageArray = messageArray.filter((arg) => arg.length > 0);
    }

    const cmdStats = client.cmdStats.get(command.name);
    if (cmdStats) {
      client.cmdStats.set(command.name, cmdStats + 1);
    } else {
      client.cmdStats.set(command.name, 1);
    }
    if (config.chRestrictions) {
      const { mode, channels } = config.chRestrictions;
      if (channels && channels.length > 0) {
        if (mode === ChannelRestrictionsModeTypes.WHITELIST) {
          if (!channels?.includes(message.channel.id)) {
            return;
          }
        } else if (mode === ChannelRestrictionsModeTypes.BLACKLIST) {
          if (channels?.includes(message.channel.id)) {
            return;
          }
        }
      }
    }

    if (mentionRegex.test(usedPrefix)) {
      usedPrefix = "[m]";
    }

    if (command.premiumOnly && !config?.isPremium) {
      return message.channel
        .createMessage(`This command is premium only. Get premium @ https://proton-bot.net/premium`)
        .catch((err) => logger.error("message create: failed to create message", err));
    }
    client.legacyCommands.cooldowns.addRatelimit(message.author.id, command, subcommand);

    // check client perms
    const hasPerms = command.clientPerms.every((perm) =>
      (message.channel as GuildChannel)
        .permissionsOf(client.user.id)
        .has(perm as keyof typeof Constants.Permissions)
    );
    if (!hasPerms) {
      return command.errorMessage(
        message as Message<GuildTextableChannel>,
        "I don't have enough permissions."
      );
    }

    // check user perms
    const userPerms = (commandCfg && commandCfg.permissions) ?? command.userPerms;
    if (
      message.member.permissions.has("administrator") === false &&
      message.author.id !== "521677874055479296"
    ) {
      const allowedRole = commandCfg?.allowedRoles?.find((x) => message.member?.roles.includes(x));
      const disallowedRole = commandCfg?.disallowedRoles?.find((x) =>
        message.member?.roles.includes(x)
      );
      if (commandCfg && commandCfg?.allowedRoles?.length && !allowedRole) {
        return command.errorMessage(
          message as Message<GuildTextableChannel>,
          `You don't have any allowed-roles to use this command.`
        );
      } else if (!allowedRole) {
        const isModerator =
          config.moderation &&
          config.moderation.modroles &&
          config.moderation.modroles.find((r) => message.member?.roles.includes(r)) !== undefined;
        if (!(isModerator && command.allowMods)) {
          const hasPerms = userPerms.every((perm) =>
            (message.channel as GuildChannel)
              .permissionsOf(message.author.id)
              .has(perm as keyof typeof Constants.Permissions)
          );
          if (!hasPerms) {
            return command.errorMessage(
              message as Message<GuildTextableChannel>,
              "You don't have enough permissions."
            );
          }
        }
      }
      if (commandCfg && disallowedRole) {
        return command.errorMessage(
          message as Message<GuildTextableChannel>,
          `You have an disallowed role for this command, you can't use it.`
        );
      }
    }

    const commandLog: CommandLog = {
      guildID: message.guildID,
      userID: message.author.id,
      command: command.name,
      message: message.content,
      slashCommand: false,
      createdAt: new Date(Date.now()),
      subcommand: null,
      executionError: false,
    };
    let isError = false;
    try {
      logger.info(
        `${getTag(message.author)} (${message.author.id}) executed command ${command.name} in ${
          message.channel.guild.name
        } (${message.channel.guild.id})`
      );
      const ctx = {
        message: message as Message<GuildTextableChannel>,
        args: args,
        config: config,
        prefix: usedPrefix,
      };
      if (subcommand && command[subcommand.name as keyof typeof command] !== undefined) {
        ctx.args = args.slice(1);
        commandLog.subcommand = subcommand.name;
        await Promise.resolve(
          (
            command[subcommand.name as keyof typeof command] as unknown as (
              args: ExecuteArgs
            ) => void
          )(ctx)
        );
      } else if (command.execute) {
        await Promise.resolve(command.execute(ctx));
      } else if (command.commands?.length > 0) {
        await command.getHelp(message as Message<GuildTextableChannel>, usedPrefix);
      }
    } catch (err) {
      isError = true;
      logger.error(`message create: command execution failed:`, err);
      message.channel
        .createMessage({
          content: `The command failed to execute, please try again later...`,
          messageReference: {
            messageID: message.id,
            failIfNotExists: true,
          },
        })
        .catch(() => 0);
    }
    if (command.name === "purge") {
      message.channel.createMessage(
        `This command is deprecated and will be removed, use \`/purge\` instead.`
      );
    }
    commandLog.executionError = isError;
    collections.command_logs.insertOne(commandLog).catch((err) => {
      logger.error(`message create: failed to create command log:`, err?.message);
    });
  } else {
    if (commandName && commandName.length > 0) {
      const tags = client.modules.get("Tags") as Tags | undefined;
      if (tags) {
        tags.executeTag(message as Message<GuildTextableChannel>, args, commandName);
      }
    }

    const levels = client.modules.get("Levels") as Levels | undefined;
    if (levels) {
      levels.handleMessage(message as Message<GuildTextableChannel>, config);
    }

    const autoResp = client.modules.get("AutoResponses") as AutoResponses | undefined;
    if (autoResp) {
      autoResp.handleMessage(message as Message<GuildTextableChannel>, config);
    }

    if (config.rep_system && config.rep_system.enabled) {
      const reputation = client.modules.get("Reputation") as Reputation | undefined;
      const lower = message.content.toLowerCase();
      if (message.messageReference && thanksRegex.test(lower)) {
        if (reputation) {
          const originalID = message.messageReference.messageID;
          if (originalID) {
            let originalMsg;
            try {
              originalMsg = await message.channel.getMessage(originalID);
            } catch (err) {
              logger.warn(
                `message create: failed to fetch original message after detecting a thank:`,
                (err as Error)?.message
              );
            }
            if (!originalMsg) {
              return;
            }

            try {
              await reputation.addRep(message.author, originalMsg.author, message.guildID);
            } catch (err) {
              if (err instanceof Reputation.ReputationError) {
                return message.channel
                  .createMessage(err.message)
                  .catch((err) => logger.error("message create: failed to create message", err));
              }
            }
          }
        }
      }
    }

    if (!config.messagePreview) {
      return;
    }
    if (!message.channel.permissionsOf(client.user.id).has("embedLinks")) {
      return;
    }

    const msgLinkMatch = msgLinkRegex.exec(message.content);
    if (msgLinkMatch && msgLinkMatch.length) {
      const guildID = msgLinkMatch[2];
      if (!guildID || guildID !== message.guildID) {
        return;
      }
      const channel = message.channel.guild.channels.get(msgLinkMatch[3]);
      if (!channel || channel.nsfw) {
        return;
      }
      if (channel.type !== 0) {
        return;
      }
      if (!channel.permissionsOf(client.user.id).has("readMessageHistory")) {
        return;
      }
      if (!channel.permissionsOf(message.member).has("readMessageHistory")) {
        return;
      }
      let targetMessage;
      try {
        targetMessage = await channel.getMessage(msgLinkMatch[4]);
      } catch (err) {
        logger.warn(
          `event: message_craete: failed to fetch message ${msgLinkMatch[4]} in channel: ${channel.id} for message-preview:`,
          err
        );
      }
      if (!targetMessage) {
        return;
      }

      const previewBuilder = new EmbedBuilder()
        .author(getTag(targetMessage.author), targetMessage.author.dynamicAvatarURL(undefined, 256))
        .color("theme")
        .description(targetMessage.content)
        .field("Jump to message", `[Click me](${targetMessage.jumpLink})`)
        .timestamp(targetMessage.createdAt);
      const types = ["image/gif", "image/jpeg", "image/png", "image/apng", "video/mp4"];
      const att = targetMessage.attachments.find(
        (att) => att.content_type && types.includes(att.content_type)
      );
      if (att) {
        previewBuilder.image(att.proxy_url);
      }
      const embeds = [previewBuilder.build()];
      for (const embed of targetMessage.embeds) {
        if (embeds.length === 10) {
          break;
        }
        if (embed.type === "rich") {
          embeds.push(embed);
        }
      }
      message.channel
        .createMessage({
          embeds: embeds,
          messageReference: { messageID: message.id },
          content: `Message sent in: ${channel.mention} [\`${channel.name}\`]`,
        })
        .catch((err) => {
          logger.error(`message create: failed to create message-preview message:`, err);
        });
    }
  }
});
