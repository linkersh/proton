import {
  AdvancedMessageContent,
  Constants,
  Guild,
  GuildTextableChannel,
  Member,
  Message,
} from "eris";
import { ProtonClient } from "../client/ProtonClient";
import { Base } from "./Base";
import { GuildConfig } from "../database/models/GuildConfig";
import { getTag } from "../../utils/Util";
import { EmbedBuilder } from "../../utils/EmbedBuilder";
import ButtonPagination from "../../utils/ButtonPagination";
import logger from "./Logger";
import prettyMilliseconds from "pretty-ms";
import { CustomEmojis, FormattedPerms } from "../../Constants";

const unicodeRegex = /[\p{Emoji}\u200d]+/gu;
const mentionRegex = /^<@!?([0-9]{16,19})>$/;
const channelRegex = /^<#([0-9]{16,19})>$/;
const channelsRegex = /[0-9]{16,19}/g;
const strictEmojiRegex = /^<(a)?:(.+?):(\d{16,18})>$/;
const emojiRegex = /<(a)?:(.+?):(\d{16,18})>/;
const rolesRegex = /[0-9]{16,19}/g;
const customEmojiRegex = /<a?:.+?:\d{16,18}>/g;
const globalUnicodeRegex = new RegExp(unicodeRegex, "g");
const snowflakeRegex = /^([0-9]+)$/;
const userTagRegex = /[\S\s]{2,32}#[0-9]{4}/;

export interface SubCommand {
  name: string;
  desc: string;
  usage: string;
  cooldown?: number;
}

export interface SubCommandStructure {
  name: string;
  desc: string;
  usage?: string;
  cooldown?: number;
}

export interface CommandOptions {
  name: string;
  description: string;
  usage: string;
  aliases: string[];
  commands?: SubCommandStructure[];
  cooldown: number;
  category: string;
  userPerms: string[];
  clientPerms: string[];
  examples?: string[];
  allowMods?: boolean;
  premiumOnly?: boolean;
  admin?: boolean;
}

export interface ExecuteArgs {
  message: Message<GuildTextableChannel>;
  args: string[];
  prefix: string;
  config: GuildConfig;
}

export interface ClientLegacyCommand {
  execute(args: ExecuteArgs): void;
}

export class ClientLegacyCommand extends Base {
  constructor(client: ProtonClient, options: CommandOptions) {
    super(client);
    this.name = options.name;
    this.description = options.description;
    this.usage = options.usage;
    this.aliases = options.aliases;
    this.commands = (options.commands ?? []).map((elem) => {
      return {
        cooldown: elem.cooldown ?? 3000,
        name: elem.name,
        desc: elem.desc,
        usage: elem.usage ?? `${this.name} ${elem.name}`,
      };
    });
    this.category = options.category;
    this.userPerms = options.userPerms;
    this.clientPerms = options.clientPerms;
    this.premiumOnly = options.premiumOnly ?? false;
    this.cooldown = options.cooldown;
    this.admin = options.admin ?? false;
    this.allowMods = options.allowMods ?? false;
    this.examples = options.examples ?? [];
  }
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly aliases: string[];
  readonly category: string;
  readonly cooldown: number;
  readonly userPerms: string[];
  readonly clientPerms: string[];
  readonly premiumOnly: boolean;
  readonly commands: SubCommand[];
  readonly admin: boolean;
  readonly allowMods: boolean;
  readonly examples: string[];

  getExampleUsage(message: Message<GuildTextableChannel>, error: string, prefix: string) {
    const builder = new EmbedBuilder()
      .author(getTag(message.author), message.author.dynamicAvatarURL(undefined, 256))
      .description(error)
      .color("theme")
      .field("Usage:", `\`${prefix}${this.name} ${this.usage}\``);
    if (this.examples) {
      builder.field("Examples:", this.examples.map((x) => `\`${prefix}${x}\``).join("\n"));
    }
    return builder.build();
  }

  getHelp(message: Message, prefix: string) {
    if (this.commands && this.commands.length) {
      const embeds = [];
      let tempString = "";
      let pageCount = Math.floor(this.commands.length / 5);
      if (this.commands.length % 5 > 0) {
        pageCount++;
      }
      let pages = 0;
      let idx = 0;
      let total = 0;
      for (const x of this.commands) {
        idx++;
        total++;
        const cmdStr = `${prefix}${this.name}${x.name ? ` ${x.name}` : ""}${
          x.usage ? ` ${x.usage}` : ""
        }`.trim();
        const toAdd = `\`${cmdStr.trim()}\`\n> ${x.desc}`;
        tempString += `\n\n${toAdd}`;
        if (idx === 5 || total === this.commands.length) {
          embeds.push(
            new EmbedBuilder()
              .description(`${this.description}${tempString}`)
              .color("theme")
              .title(`Page (${pages + 1}/${pageCount})`)
              .build()
          );
          pages++;
          idx = 0;
          tempString = "";
        }
      }
      const pagination = new ButtonPagination(
        embeds.map((x) => ({ embeds: [x] })),
        message.author.id
      );
      return pagination
        .create(message.channel)
        .catch((err) =>
          logger.error(
            `command pagination: failed to create pagination for command: ${this.name}:`,
            err?.message
          )
        );
    } else {
      const builder = new EmbedBuilder()
        .title(this.usage)
        .description(this.description)
        .footer(`Cooldown: ${prettyMilliseconds(this.cooldown)}`)
        .color("theme");
      if (this.aliases && this.aliases.length) {
        builder.field("Aliases", this.aliases.map((x) => `\`${x}\``).join(", "));
      }
      if (this.userPerms && this.userPerms.length) {
        builder.field(
          "Required Permissions",
          this.userPerms
            .map((x) => `${FormattedPerms[x as keyof typeof FormattedPerms]}`)
            .join(", ")
        );
      }
      return message.channel.createMessage({ embeds: [builder.build()] });
    }
  }
  parseRole(content: string, guild: Guild) {
    const mention = mentionRegex.exec(content);
    if (mention && mention.length > 1) {
      return guild.roles.get(mention[1]);
    }
    if (guild.roles.has(content)) {
      return guild.roles.get(content);
    }
    return guild.roles.find((x) => x.name === content);
  }
  parseChannel(content: string, guild: Guild) {
    let channel;
    const mention = channelRegex.exec(content);
    if (mention && mention.length > 1) {
      channel = guild.channels.get(mention[1]);
    }
    if (!channel && guild.channels.has(content)) {
      channel = guild.channels.get(content);
    } else if (!channel) {
      channel = guild.channels.find((x) => x.name === content);
    }
    if (channel && channel.type !== Constants.ChannelTypes.GUILD_TEXT) {
      return;
    }
    return channel;
  }
  parseChannels(content: string, guild: Guild) {
    const mention = content.matchAll(channelsRegex);
    const ids = [];
    let m = mention.next();
    while (m !== null && !m.done) {
      const id = m.value[0];
      if (guild && !guild.channels.has(id)) {
        m = mention.next();
        continue;
      }
      ids.push(id);
      m = mention.next();
    }
    return ids;
  }
  parseEmoji(content = "", exact = true) {
    const customRegex = exact ? strictEmojiRegex : emojiRegex;
    const customMatch = customRegex.exec(content);
    if (customMatch && customMatch.length) {
      const name = customMatch[2];
      const id = customMatch[3];
      const animated = customMatch[1] ? true : false;
      if (!name || !id) {
        return;
      }
      return { name, id, animated };
    }
    const unicodeMatch = unicodeRegex.exec(content);
    if (unicodeMatch && unicodeMatch.length) {
      return {
        id: null,
        name: unicodeMatch[0],
        animated: false,
      };
    }
  }
  parseRoles(content = "", guild: Guild) {
    const mention = content.matchAll(rolesRegex);
    const ids = [];
    let m = mention.next();
    while (m !== null && !m.done) {
      const id = m.value[0];
      if (guild && !guild.roles.has(id)) {
        m = mention.next();
        continue;
      }
      ids.push(id);
      m = mention.next();
    }
    return ids;
  }
  countEmojis(string = "") {
    let total = 0;
    const customMatch = string.match(customEmojiRegex);
    if (customMatch && customMatch.length > 0) {
      total += customMatch.length;
    }
    const unicodeMatch = string.match(globalUnicodeRegex);
    if (unicodeMatch && unicodeMatch.length) {
      total += unicodeMatch.length;
    }
    return total;
  }
  isModerator(member: Member, config: GuildConfig) {
    if (!config.moderation || !config.moderation.modroles) {
      return false;
    }
    if (config.moderation.modroles.find((x) => member.roles.includes(x))) {
      return true;
    }
    return false;
  }
  isUserID(string: string) {
    return snowflakeRegex.test(string);
  }

  async resolveMember(string = "", guild: Guild) {
    if (!string) {
      return null;
    }
    const members = [...guild.members.values()];
    const mention = mentionRegex.exec(string);
    if (mention && mention.length > 1) {
      return members.find((x) => x.id === mention[1]);
    }
    const id = snowflakeRegex.exec(string);
    if (id && id.length > 0) {
      let member;
      try {
        member = guild.members.get(id[0]);
        if (!member) {
          member = await this.client.getRESTGuildMember(guild.id, id[0]).then((m) => {
            guild.members.add(m, guild);
            return m;
          });
        }
        if (member) {
          return member;
        }
        // eslint-disable-next-line
      } catch {}
    }
    if (userTagRegex.test(string)) {
      return members.find((x) => getTag(x.user) === string);
    }
    const name = string;
    const fromCache = members.find((x) => x.user?.username === string || x.nick === string);
    if (fromCache) {
      return fromCache;
    }
    const search = await guild.searchMembers(name, 1);
    if (search && search.length) {
      guild.members.add(search[0], guild);
      return search[0];
    }
  }
  async resolveUser(string: string) {
    const mention = snowflakeRegex.exec(string);
    if (mention && mention.length > 1) {
      return this.client.users.get(mention[1]);
    }
    const id = snowflakeRegex.exec(string);
    if (id && id.length > 0) {
      if (this.client.users.has(id[0])) {
        return this.client.users.get(id[0]);
      }
      try {
        const user = await this.client.getRESTUser(id[0]);
        if (user) {
          this.client.users.add(user, null, true);
          return user;
        }
      } catch {
        return;
      }
    }
  }
  successMessage(message: Message<GuildTextableChannel>, content: string) {
    const contentData: AdvancedMessageContent = { content: "" };
    if (message.channel.permissionsOf(this.client.user.id).has("readMessageHistory")) {
      contentData["messageReference"] = {
        messageID: message.id,
        failIfNotExists: false,
      };
    }
    if (message.channel.permissionsOf(this.client.user.id).has("useExternalEmojis")) {
      contentData["content"] += `${CustomEmojis.GreenTick} `;
    } else {
      contentData.content += "✅";
    }
    contentData["content"] += content;
    message.channel
      .createMessage(contentData)
      .catch((err) => logger.error(`failed to create message in command`, err));
  }

  errorMessage(message: Message<GuildTextableChannel>, content: string) {
    const contentData: AdvancedMessageContent = { content: "" };
    if (message.channel.permissionsOf(this.client.user.id).has("readMessageHistory")) {
      contentData["messageReference"] = {
        messageID: message.id,
        failIfNotExists: false,
      };
    }
    if (message.channel.permissionsOf(this.client.user.id).has("useExternalEmojis")) {
      contentData["content"] += `${CustomEmojis.RedTick} `;
    } else {
      contentData.content += "❌";
    }
    contentData["content"] += content;
    message.channel
      .createMessage(contentData)
      .catch((err) => logger.error(`failed to create message in command`, err));
  }
}
