import { ProtonClient } from "../../core/client/ProtonClient.js";
import { collections } from "../../core/database/DBClient.js";
import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand.js";

const colorRegex = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;
const attachmentRegex = /https:\/\/(i\.)?imgur\.com\/[A-Za-z0-9]+\.(png|jpg|jpeg)/;

class RankCard extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "rankcard",
      description: "Customize your rank card.",
      usage: "<command>",
      commands: [
        {
          name: "color",
          desc: "Set a custom color for your rank card.",
          usage: "<hex-color>",
        },
        {
          name: "image",
          desc: "Set a custom background image for your rank card.",
          usage: "<attachment url>",
        },
      ],
      aliases: ["card"],
      cooldown: 3000,
      category: "levels",
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks"],
    });
  }
  async color({ message, args }: ExecuteArgs) {
    const color = colorRegex.exec(args[0]);
    if (color && color.length) {
      await collections.levels.updateOne(
        { guildID: message.guildID, userID: message.author.id },
        {
          $set: {
            rankcardColor: color[0],
          },
          $setOnInsert: {
            level: 0,
            xp: { total: 0, current: 0, required: 100 },
          },
        },
        { upsert: true }
      );
      this.successMessage(
        message,
        `Your rank card color in this server has been set to \`${color[0]}\``
      );
    } else {
      return this.errorMessage(message, "Thats not a valid hex color.");
    }
  }
  async image({ message, args }: ExecuteArgs) {
    if (args[0] === "default") {
      await collections.levels.updateOne(
        { guildID: message.guildID, userID: message.author.id },
        {
          $unset: { rankcardImage: "" },
        },
        { upsert: true }
      );
      return this.successMessage(
        message,
        `Updated your rank card image in this server, if you still see the default one it means the bot can't fetch it.`
      );
    }
    let imgMatch: string[] = [];
    const reImgMatch = attachmentRegex.exec(args[0]);
    const upload = message.attachments.find(
      (x) => x.content_type !== undefined && x.content_type.startsWith("image")
    );
    if (reImgMatch) {
      imgMatch = [reImgMatch[0]];
    }
    if (upload) {
      imgMatch = [upload.url];
    }
    if (!imgMatch || !imgMatch.length) {
      return this.errorMessage(
        message,
        "Please either upload an image with your message or upload it to imgur and specify the link."
      );
    }
    if (imgMatch[0].startsWith("https://imgur")) {
      imgMatch[0] = imgMatch[0].replace("https://imgur", "https://i.imgur");
    }
    await collections.levels.updateOne(
      { guildID: message.guildID, userID: message.author.id },
      {
        $set: {
          rankcardImage: imgMatch[0],
        },
        $setOnInsert: {
          level: 0,
          xp: { total: 0, current: 0, required: 100 },
        },
      },
      { upsert: true }
    );
    this.successMessage(
      message,
      `Updated your rank card image in this server, if you still see the default one it means the bot can't fetch it.`
    );
  }
}
export default RankCard;
