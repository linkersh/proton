import { Constants, Guild, GuildTextableChannel, Member, Message } from "eris";
import { AutoModWhitelistDataTypes, AutoModWhitelistFilterTypes } from "../../Constants";
import { ProtonClient } from "../../core/client/ProtonClient";
import { GuildConfig } from "../../core/database/models/GuildConfig";
import { SpamRaid } from "./SpamRaid";
import ClientModule from "../../core/structs/ClientModule";
import logger from "../../core/structs/Logger";
import Checker from "./Checker";
import Moderator from "./Moderator";
import Filters from "./Filters";
import { getTag, highestRole } from "../../utils/Util";
import { EmbedBuilder } from "../../utils/EmbedBuilder";

const hoistRegex = /^((!|')\s*)+/;
const nonAsciiRegex = /[^\x00-\x7F]/;
const nonAsciiGlobalRegex = new RegExp(nonAsciiRegex, "g");

const cleanRegex1 = /%CC(%[A-Z0-9]{2})+%20/g;
const cleanRegex2 = /%CC(%[A-Z0-9]{2})+(\w)/g;
const cleanRegex3 = /(?:[\p{M}]{1})([\p{M}])+?/gisu;

export interface Counter {
  messageIDs: Set<string>;
  points: number;
  timestamp: number;
}

export interface RaidCounter {
  messages: Set<string>;
  timestamp: number;
  moderatedLevels: number[];
}

export default class AutoMod extends ClientModule {
  constructor(client: ProtonClient) {
    super(client, "AutoMod");
  }
  readonly messageCache: Checker = new Checker(
    this.client,
    "Message spam ",
    "don't spam messages!"
  );
  readonly mentionCache: Checker = new Checker(
    this.client,
    "Mention spam ",
    "don't spam mention users!"
  );
  readonly stickerCache: Checker = new Checker(
    this.client,
    "Sticker spam ",
    "don't spam stickers!"
  );
  readonly emojiCache: Checker = new Checker(
    this.client,
    "Emoji spam",
    "don't use too much emojis!"
  );
  readonly attachmentCache: Checker = new Checker(
    this.client,
    "Attachment spam ",
    "don't spam too many attachments!"
  );
  readonly moderator = new Moderator(this.client);
  readonly spamRaid = new SpamRaid();

  clearZalgo(text: string) {
    const encode = encodeURIComponent(text);
    const clean = encode.replace(cleanRegex1, " ").replace(cleanRegex2, "$2");
    return decodeURIComponent(clean).replace(cleanRegex3, "");
  }

  isWhitelisted(
    message: Message<GuildTextableChannel>,
    type: AutoModWhitelistFilterTypes,
    config: GuildConfig
  ) {
    if (!config.automod || !message.member || !config.automod.whitelist) {
      return false;
    }
    if (message.member === null) {
      return false;
    }
    const whitelist = config.automod.whitelist.some((whitelist) => {
      if (whitelist.filter_type === type) {
        if (whitelist.data_type === AutoModWhitelistDataTypes.ROLE) {
          if (message.member.roles.includes(whitelist.id)) {
            return true;
          }
        } else if (whitelist.data_type === AutoModWhitelistDataTypes.CHANNEL) {
          if (message.channel.id === whitelist.id || message.channel.parentID === whitelist.id) {
            return true;
          }
        }
      }
    });
    return whitelist;
  }

  async moderateName(member: Member, guild: Guild, config: GuildConfig) {
    if (!config.isPremium) {
      return;
    }
    if (member.permissions.has("manageGuild")) {
      return;
    }

    const selfMember = await this.client.getSelfMember(guild);
    if (!selfMember) {
      return;
    }
    if (!guild.permissionsOf(selfMember).has("manageNicknames")) {
      return;
    }
    if (highestRole(member, guild).position >= highestRole(selfMember, guild).position) {
      return;
    }
    let name = member.nick || member.username;
    const oldName = member.nick || member.username;
    name = name.replace(hoistRegex, ""); // remove all ! and ' at the start of the name
    if (nonAsciiRegex.test(name)) {
      // try match any unmentionable text EMOJIS supported
      name = name
        .normalize("NFKD") // normalize the string
        .replace(nonAsciiGlobalRegex, ""); // replace the unmentionablke text
      //.replace(/[\u0300-\u036f]/g, "");
    }
    name = this.clearZalgo(name); // remove zalgo and unreadable text
    name = name.trim(); // remove any extra spaces from the username
    if (name === oldName) {
      return;
    }
    if (name.length === 0) {
      let randomStr = "";
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      for (let x = 0; x < 7; x++) {
        randomStr += characters[Math.floor(Math.random() * characters.length)];
      }
      name = `Moderated username ${randomStr}`;
    }
    member
      .edit({ nick: name })
      .catch((err) =>
        logger.error(`module: AutoMod: moderate name: failed to edit member nickname`, err)
      );

    if (config.moderation && config.moderation.log_channel) {
      const logChannel = guild.channels.get(config.moderation.log_channel);
      if (
        logChannel &&
        (logChannel.type === Constants.ChannelTypes.GUILD_TEXT ||
          logChannel.type === Constants.ChannelTypes.GUILD_NEWS) &&
        logChannel.permissionsOf(selfMember).has("sendMessages")
      ) {
        const logEmbed = new EmbedBuilder()
          .title("Username Moderated")
          .author(getTag(member.user), member.user.dynamicAvatarURL(undefined, 256))
          .field("Details:", `**Old name:** ${oldName}\n**New nickname:** ${name}`)
          .thumbnail(member.user.dynamicAvatarURL(undefined, 256))
          .color("#ffec73")
          .timestamp(new Date());
        logChannel.createMessage({ embeds: [logEmbed.build()] }).catch(() => null);
      }
    }
  }

  async handleMessage(message: Message<GuildTextableChannel>, config: GuildConfig, edited = false) {
    if (!config.automod || !message.member) {
      return false;
    }
    if (config.moderation && config.moderation.modroles && config.moderation.modroles.length > 0) {
      if (config.moderation.modroles.find((x) => message.member.roles.includes(x))) {
        return false;
      }
    }
    const perms = message.member.permissions;
    if (perms.has("manageGuild") || perms.has("administrator")) {
      return false;
    }
    if (this.isWhitelisted(message, AutoModWhitelistFilterTypes.GLOBAL, config)) {
      return false;
    }
    if (config.automod.messageRaidLevels) {
      const data = await this.spamRaid.handleMessage(message, config, this);
      if (data === true) return true;
    }
    const filters: Array<{ name: keyof typeof Filters; cond: boolean }> = [
      {
        name: "spam",
        cond:
          !edited && !this.isWhitelisted(message, AutoModWhitelistFilterTypes.MESSAGE_SPAM, config),
      },
      {
        name: "mentions",
        cond: !edited && !this.isWhitelisted(message, AutoModWhitelistFilterTypes.MENTIONS, config),
      },
      {
        name: "caps",
        cond: !this.isWhitelisted(message, AutoModWhitelistFilterTypes.CAPS_LOCK, config),
      },
      {
        name: "stickers",
        cond: !edited && !this.isWhitelisted(message, AutoModWhitelistFilterTypes.STICKERS, config),
      },
      {
        name: "invites",
        cond: !this.isWhitelisted(message, AutoModWhitelistFilterTypes.INVITES, config),
      },
      {
        name: "emojis",
        cond: !this.isWhitelisted(message, AutoModWhitelistFilterTypes.EMOJIS, config),
      },
      {
        name: "links",
        cond: !this.isWhitelisted(message, AutoModWhitelistFilterTypes.LINKS, config),
      },
      {
        name: "badwords",
        cond: !this.isWhitelisted(message, AutoModWhitelistFilterTypes.BADWORDS, config),
      },
      {
        name: "attachments",
        cond:
          !edited && !this.isWhitelisted(message, AutoModWhitelistFilterTypes.ATTACHMENTS, config),
      },
      {
        name: "duplicates",
        cond: !this.isWhitelisted(message, AutoModWhitelistFilterTypes.DUPLICATES, config),
      },
    ];
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      if (!filter.cond) {
        continue;
      }
      try {
        const result = await Promise.resolve(Filters[filter.name](message, config, this));
        if (result === true) {
          return true;
        }
      } catch (err) {
        logger.warn(`module: automod: failed to process auto-mod filter: ${filter.name}`, err);
      }
    }
    if (config.automod?.toxicity || config.automod?.insults || config.automod?.spam_messages) {
      if (await Filters.googleAI(message, config, this)) {
        return true;
      }
    }
  }
}
