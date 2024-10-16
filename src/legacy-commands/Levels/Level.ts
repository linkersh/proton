import {
  ClientLegacyCommand as Command,
  ExecuteArgs,
} from "../../core/structs/ClientLegacyCommand";
import { abbrev } from "../../utils/Util.js";
import { fillTextWithTwemoji } from "node-canvas-with-twemoji-and-discord-emoji";
import { ProtonClient } from "../../core/client/ProtonClient";
import { collections } from "../../core/database/DBClient";
import canvas from "canvas";
import Logger from "../../core/structs/Logger.js";
import path from "path/posix";

const { createCanvas, loadImage } = canvas;

class Level extends Command {
  constructor(client: ProtonClient) {
    super(client, {
      name: "level",
      description: "View your or someone's level in this server.",
      usage: "[user]",
      aliases: ["rank"],
      cooldown: 4000,
      category: "levels",
      userPerms: [],
      clientPerms: ["sendMessages", "embedLinks", "attachFiles"],
    });
  }
  async execute({ message, args, config }: ExecuteArgs) {
    if (!config.levels || !config.levels.enabled) {
      return this.errorMessage(
        message,
        "Levelling system is disabled in this server. An admin can enable it with `levelconfig enable` command!"
      );
    }
    const member =
      (await this.resolveMember(args.join(" "), message.channel.guild)) || message.member;
    if (!member) {
      return this.errorMessage(message, "Couldn't retrieve member data, please try again later...");
    }
    if (member.user.bot) {
      return this.errorMessage(message, "Bots don't have a rank.");
    }
    const userLevel = await collections.levels.findOne({
      guildID: message.guildID,
      userID: member.id,
    });
    if (!userLevel) {
      if (member.id === message.author.id) {
        return message.channel
          .createMessage({
            content: "You don't have a level.",
            messageReference: {
              messageID: message.id,
              failIfNotExists: false,
            },
          })
          .catch((err) => Logger.warn(`command: level: failed to send a message`, err));
      } else {
        return message.channel
          .createMessage({
            content: "That user doesn't have a level 🙄",
            messageReference: {
              messageID: message.id,
              failIfNotExists: false,
            },
          })
          .catch((err) => Logger.warn(`command: level: failed to send a message`, err));
      }
    }
    await message.channel.sendTyping();
    const defaultImage = path.join(__dirname, "..", "..", "..", "assets", "rankcard.png");
    let customImage = null;
    let main_color = "#5865F2";
    if (userLevel.rankcardImage) {
      customImage = userLevel.rankcardImage;
    }
    if (userLevel.rankcardColor) {
      main_color = userLevel.rankcardColor;
    }
    let rank = await collections.levels.countDocuments(
      {
        guildID: message.guildID,
        "xp.total": { $gt: userLevel.xp?.total || 0 },
      },
      { hint: "guildID_1_userID_1_xp.total_-1" }
    );
    if (isNaN(rank)) {
      return this.errorMessage(message, "Failed to fetch, please try again later.");
    }
    rank += 1;
    const canvas = createCanvas(1100, 370);
    const ctx = canvas.getContext("2d");
    ctx.globalAlpha = 0.8;
    let backgroundImg;
    try {
      backgroundImg = await loadImage(customImage || defaultImage);
    } catch {
      backgroundImg = await loadImage(defaultImage);
    }
    const h = canvas.height;
    const w = canvas.width;
    const x = 0;
    const y = 0;
    const r = 50;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.font = "bold 44px Manrope";
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    await fillTextWithTwemoji(ctx, member.user.username, 320, 220);
    ctx.font = "44px Manrope";
    ctx.fillStyle = "white";
    ctx.textAlign = "end";
    ctx.fillText(`Rank #${rank}`, 1010, 220);
    ctx.font = "44px Manrope";
    ctx.fillStyle = "white";
    // prettier-ignore
    const levelWidth = 1110 - ctx.measureText(abbrev(userLevel.level)).width - 7 - ctx.measureText(`Level`).width;
    ctx.fillText(`Level`, levelWidth, 80);
    ctx.font = "44px Manrope";
    ctx.fillStyle = main_color;
    ctx.textAlign = "right";
    ctx.fillText(abbrev(userLevel.level), 950 + ctx.measureText(`Level`).width - 30, 80);
    const barHeight = 280;
    const barWidth = 50;
    const x_start = 730 + barHeight; /* + barWidth*/
    const x_end = 310;
    const barLength = x_start - x_end;
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4d4d4d";
    ctx.lineWidth = barWidth;
    ctx.moveTo(x_start, barHeight);
    ctx.lineTo(x_end, barHeight);
    ctx.stroke();
    ctx.closePath();
    ctx.beginPath();
    ctx.lineWidth = barWidth;
    ctx.moveTo(x_end, barHeight);
    ctx.lineTo(x_end + barLength * (userLevel.xp.current / userLevel.xp.required), barHeight);
    ctx.strokeStyle = main_color;
    ctx.stroke();
    ctx.closePath();
    const xpText = `${Math.floor((userLevel.xp.current / userLevel.xp.required) * 100)}%`;
    ctx.font = "44px Manrope";
    ctx.fillStyle = "white";
    ctx.textAlign = "right";
    ctx.fillText(xpText, barLength / 2 + x_end, 297);
    ctx.beginPath();
    const logorad = 108;
    ctx.arc(67 + logorad, 83 + logorad, logorad, 0, Math.PI * 2, true);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.closePath();
    ctx.clip();
    let content = "";
    try {
      const avatar = await loadImage(member.user.dynamicAvatarURL("jpg", 256));
      ctx.drawImage(avatar, 67, 83, 2 * logorad, 2 * logorad);
    } catch (err) {
      Logger.warn(
        `command: leaderboard: failed to load user avatar, user id:`,
        message.author.id,
        "guild id:",
        message.guildID,
        err
      );
      content += `Avatar failed to load, no worries this should be fixed soon!`;
    }
    canvas.toBuffer((err, res) => {
      if (err) {
        this.errorMessage(message, `Couldn't generate your rank-card.`);
      } else {
        this.client
          .createMessage(
            message.channel.id,
            {
              messageReference: { messageID: message.id },
              content: content,
            },
            [
              {
                name: "rankcard.png",
                file: res,
              },
            ]
          )
          .catch((err) => {
            Logger.warn(`command: level: failed to send a message`, err);
            this.errorMessage(message, "Failed to show the rank card, please try again later.");
          });
      }
    });
  }
}
export default Level;
