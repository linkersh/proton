import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import type { ProtonClient } from "../../core/client/ProtonClient";
import axios from "axios";
import Logger from "../../core/structs/Logger.js";

const strictEmojiRegex = /^<a?:.+?:(\d{16,18})>$/;
const linkRegex = /^<(a)?:(.+?):(\d{16,18})>$/;
const linkRegex2 = /^<(a)?:.+?:(\d{16,18})>$/;

class AddEmoji extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "addemoji",
      description: "Add an emoji to this server.",
      usage: "[emoji-name] <emoji|emoji_link|attachment>",
      aliases: ["add-emoji"],
      category: "util",
      cooldown: 5000,
      userPerms: ["manageEmojisAndStickers"],
      clientPerms: ["manageEmojisAndStickers"],
    });
  }
  async execute({ message, args }: ExecuteArgs) {
    let emoji_url = "",
      emoji_name = "";
    if (strictEmojiRegex.test(args[0])) {
      const emoji = linkRegex.exec(args[0]) || [];
      const id = emoji[3];
      const animated = emoji[1] === "a";
      emoji_url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
      emoji_name = emoji[2];
    } else if (strictEmojiRegex.test(args.slice(1).join(" "))) {
      const emoji = linkRegex2.exec(args.slice(1).join(" ")) || [];
      const animated = emoji[1] === "a";
      const id = emoji[2];
      emoji_url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
      emoji_name = args[0];
    } else {
      const attachments = message.attachments.filter(
        (att) =>
          att.content_type &&
          (att.content_type === "image/gif" ||
            att.content_type === "image/jpeg" ||
            att.content_type === "image/png")
      );
      if (attachments.length > 0) {
        emoji_url = attachments[0].proxy_url;
        emoji_name = args[0];
      } else {
        try {
          const toURL = new URL(args[1] ? args[1] : args[0]);
          if (
            !toURL.hostname.endsWith("discordapp.com") &&
            !toURL.hostname.endsWith("discord.com") &&
            !toURL.hostname.endsWith("discordapp.net")
          ) {
            return this.errorMessage(message, `Invalid emoji URL.`);
          }
          emoji_url = toURL.href;
          if (args[1]) {
            emoji_name = args[0];
          }
        } catch {
          return this.errorMessage(message, `Invalid emoji URL.`);
        }
      }
    }
    if (!emoji_url) {
      return this.errorMessage(
        message,
        "You need to give me a valid emoji url like: <https://cdn.discordapp.com/emojis/823054048319635457.png?v=1> or use the emoji in your message."
      );
    }
    if (!emoji_name) {
      emoji_name = "give_me_a_name";
    }

    let emojiData;
    try {
      emojiData = await axios.get(emoji_url, {
        responseType: "arraybuffer",
        maxContentLength: 256000,
        maxBodyLength: 256000,
      });
    } catch (e) {
      if (String(e).includes("256000 exceeded")) {
        return this.errorMessage(message, "The emoji provided is above 256kb.");
      }
      return this.errorMessage(message, "Invalid emoji provided.");
    }
    const emojiToBuffer = Buffer.from(emojiData.data, "binary").toString("base64");
    try {
      const emoji = await message.channel.guild.createEmoji({
        name: emoji_name || "give_me_a_name",
        image: `data:image/jpg;base64,${emojiToBuffer}`,
      });
      const emojiFormat = `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
      message.channel
        .createMessage({
          content: `Created an emoji \`${emoji.name}\` ${emojiFormat}`,
          messageReference: { messageID: message.id },
        })
        .catch((err) => Logger.warn(`command: add-emoji: failed to create message `, err));
    } catch {
      const toMakeSure = [
        "- You have enough emoji slots",
        "- The emoji size is below 250kb",
        "- The emoji name contains unicode characters",
      ].join("\n");
      this.errorMessage(message, `Failed to create emoji, make sure:\n${toMakeSure}`);
    }
  }
}
export default AddEmoji;
